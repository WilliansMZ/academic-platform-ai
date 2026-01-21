import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokenPayload } from './types/jwt-payload.type';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';

import { compareHash, hashValue } from './utils/crypto.util';
import { ttlToMs } from './utils/ttl.util';

type RefreshTokenPayload = AccessTokenPayload & { sid: string };
// Para acceder a jti sin pelear con tipos:
type VerifiedRefreshPayload = RefreshTokenPayload & { jti?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private signAccessToken(payload: AccessTokenPayload) {
    return this.jwt.signAsync(payload as any, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    } as any);
  }

  // ✅ Ahora devuelve { token, jti }
  private async signRefreshToken(payload: RefreshTokenPayload) {
    const jti = randomUUID();
    const token = await this.jwt.signAsync(payload as any, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL ?? '30d',
      jwtid: jti,
    } as any);

    return { token, jti };
  }

  private getRefreshExpiresAt(): Date {
    const ttl = process.env.JWT_REFRESH_TTL ?? '30d';
    return new Date(Date.now() + ttlToMs(ttl));
  }

  private async storeRefreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
    jti: string,
  ) {
    const tokenHash = await hashValue(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        sessionId,
        tokenHash,
        jti, // ✅ guardar jti
        expiresAt: this.getRefreshExpiresAt(),
      },
    });
  }

  // 👇 revoca SOLO una sesión
  private async revokeSession(sessionId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.update({
        where: { id: sessionId },
        data: { revokedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  // 👇 logout global
  private async revokeAllSessions(userId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async login(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [{ email: identifier }, { username: identifier }],
      },
      select: {
        id: true,
        institutionId: true,
        role: true,
        email: true,
        username: true,
        passwordHash: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await compareHash(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // ✅ MVP: SUPERADMIN no habilitado aún (evita 500 y deja claro el comportamiento)
    if (user.role === Role.SUPERADMIN) {
      throw new ForbiddenException('SUPERADMIN login no habilitado en el MVP');
    }

    // ✅ En MVP, usuarios tenant deben tener institutionId
    if (!user.institutionId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      institutionId: user.institutionId,
      role: user.role,
      email: user.email,
      username: user.username,
    };

    // ✅ multi-dispositivo: nueva sesión
    const session = await this.prisma.authSession.create({
      data: { userId: user.id },
      select: { id: true },
    });

    const refreshPayload: RefreshTokenPayload = {
      ...accessPayload,
      sid: session.id,
    };

    const accessToken = await this.signAccessToken(accessPayload);

    const refresh = await this.signRefreshToken(refreshPayload);
    await this.storeRefreshToken(user.id, session.id, refresh.token, refresh.jti);

    return {
      accessToken,
      refreshToken: refresh.token,
      user: {
        id: user.id,
        institutionId: user.institutionId,
        role: user.role,
        email: user.email,
        username: user.username,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: VerifiedRefreshPayload;

    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const jti = payload.jti;
    if (!jti) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
      select: {
        id: true,
        institutionId: true,
        role: true,
        email: true,
        username: true,
      },
    });
    if (!user) throw new UnauthorizedException('User inactive');

    // ✅ MVP: refresh solo para usuarios tenant (no SUPERADMIN) y con institutionId
    if (user.role === Role.SUPERADMIN || !user.institutionId) {
      throw new UnauthorizedException('User inactive');
    }

    // ✅ sesión viva
    const session = await this.prisma.authSession.findFirst({
      where: { id: payload.sid, userId: user.id, revokedAt: null },
      select: { id: true },
    });
    if (!session) throw new UnauthorizedException('Session revoked');

    // ✅ VALIDACIÓN FUERTE: buscar EXACTAMENTE este refresh por jti
    const record = await this.prisma.refreshToken.findFirst({
      where: {
        jti,
        userId: user.id,
        sessionId: session.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, tokenHash: true },
    });

    // Si no existe activo => token reutilizado o revocado => revocar sesión (reuse detection)
    if (!record) {
      await this.revokeSession(session.id);
      throw new ForbiddenException('Refresh token reuse detected');
    }

    // (Opcional pero recomendado) confirmar que el token recibido coincide con el hash guardado
    const ok = await compareHash(refreshToken, record.tokenHash);
    if (!ok) {
      await this.revokeSession(session.id);
      throw new ForbiddenException('Refresh token reuse detected');
    }

    const newAccessPayload: AccessTokenPayload = {
      sub: user.id,
      institutionId: user.institutionId,
      role: user.role,
      email: user.email,
      username: user.username,
    };

    const newRefreshPayload: RefreshTokenPayload = {
      ...newAccessPayload,
      sid: session.id,
    };

    const accessTokenNew = await this.signAccessToken(newAccessPayload);
    const refreshNew = await this.signRefreshToken(newRefreshPayload);

    // ✅ transacción: revoke viejo + crear nuevo
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          tokenHash: await hashValue(refreshNew.token),
          jti: refreshNew.jti,
          expiresAt: this.getRefreshExpiresAt(),
        },
      }),
      this.prisma.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    return { accessToken: accessTokenNew, refreshToken: refreshNew.token };
  }

  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      await this.revokeAllSessions(userId);
      return { success: true };
    }

    let payload: VerifiedRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      return { success: true };
    }

    if (payload.sub !== userId) return { success: true };

    await this.revokeSession(payload.sid);
    return { success: true };
  }
}
