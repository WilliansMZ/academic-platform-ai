import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import type { CurrentUser } from './users.types';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertTenant(actor: CurrentUser) {
    if (!actor.institutionId) {
      throw new ForbiddenException('Tenant context required');
    }
  }

  private assertAdmin(actor: CurrentUser) {
    if (actor.role !== Role.INSTITUTION_ADMIN) {
      throw new ForbiddenException('Insufficient role');
    }
  }

  async me(actor: CurrentUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: { teacherProfile: true, studentProfile: true },
    });

    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    if (!user.isActive) throw new ForbiddenException('User is inactive');

    // Evita fuga cross-tenant: si es usuario tenant debe coincidir
    if (user.institutionId && actor.institutionId && user.institutionId !== actor.institutionId) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(actor: CurrentUser, dto: CreateUserDto) {
    this.assertAdmin(actor);
    this.assertTenant(actor);

    if (dto.role === Role.SUPERADMIN) {
      throw new UnprocessableEntityException('Cannot create SUPERADMIN from tenant scope');
    }

    // Debe existir al menos 1 identifier
    if (!dto.email && !dto.username && !dto.phoneE164) {
      throw new BadRequestException('email or username or phoneE164 is required');
    }

    // Perfil según rol
    if (dto.role === Role.TEACHER && !dto.teacherProfile?.fullName) {
      throw new BadRequestException('teacherProfile.fullName is required for TEACHER');
    }
    if (dto.role === Role.STUDENT && !dto.studentProfile?.fullName) {
      throw new BadRequestException('studentProfile.fullName is required for STUDENT');
    }

    const institutionId = actor.institutionId!;

    // Conflictos por uniques (considera deletedAt)
    const [emailExists, usernameExists, phoneExists] = await Promise.all([
      dto.email
        ? this.prisma.user.findFirst({
            where: { institutionId, email: dto.email, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.username
        ? this.prisma.user.findFirst({
            where: { institutionId, username: dto.username, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.phoneE164
        ? this.prisma.user.findFirst({
            where: { institutionId, phoneE164: dto.phoneE164, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (emailExists) throw new ConflictException('Email already exists');
    if (usernameExists) throw new ConflictException('Username already exists');
    if (phoneExists) throw new ConflictException('Phone already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const created = await this.prisma.user.create({
      data: {
        institutionId,
        role: dto.role,
        email: dto.email ?? null,
        username: dto.username ?? (dto.email ? dto.email.split('@')[0] : null),
        phoneE164: dto.phoneE164 ?? null,
        passwordHash,
        isActive: true,
        teacherProfile:
          dto.role === Role.TEACHER
            ? { create: { fullName: dto.teacherProfile!.fullName, phone: dto.teacherProfile?.phone, specialty: dto.teacherProfile?.specialty } }
            : undefined,
        studentProfile:
          dto.role === Role.STUDENT
            ? { create: { fullName: dto.studentProfile!.fullName, contactPhone: dto.studentProfile?.contactPhone, gradeLevel: dto.studentProfile?.gradeLevel, sectionLabel: dto.studentProfile?.sectionLabel } }
            : undefined,
      },
      include: { teacherProfile: true, studentProfile: true },
    });

    return created;
  }

  async getById(actor: CurrentUser, id: string) {
    this.assertAdmin(actor);
    this.assertTenant(actor);

    const user = await this.prisma.user.findFirst({
      where: { id, institutionId: actor.institutionId!, deletedAt: null },
      include: { teacherProfile: true, studentProfile: true },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async list(actor: CurrentUser, query: ListUsersQueryDto) {
    this.assertAdmin(actor);
    this.assertTenant(actor);

    const institutionId = actor.institutionId!;
    const page = query.page ?? 1;
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 50);
    const skip = (page - 1) * pageSize;

    const where: any = {
      institutionId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.role ? { role: query.role } : {}),
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
    };

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { email: { contains: s, mode: 'insensitive' } },
        { username: { contains: s, mode: 'insensitive' } },
        { teacherProfile: { is: { fullName: { contains: s, mode: 'insensitive' } } } },
        { studentProfile: { is: { fullName: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const orderBy: any = { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: { teacherProfile: true, studentProfile: true },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async update(actor: CurrentUser, id: string, dto: UpdateUserDto) {
    this.assertAdmin(actor);
    this.assertTenant(actor);

    if (actor.sub === id) {
      // evita que el admin se rompa a sí mismo con cambios peligrosos
      // (si quieres permitirlo, documenta y controla)
    }

    const existing = await this.prisma.user.findFirst({
      where: { id, institutionId: actor.institutionId!, deletedAt: null },
      include: { teacherProfile: true, studentProfile: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    if (dto.role === Role.SUPERADMIN) {
      throw new UnprocessableEntityException('Cannot promote to SUPERADMIN');
    }

    // Conflictos (si cambia)
    if (dto.email && dto.email !== existing.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { institutionId: actor.institutionId!, email: dto.email, deletedAt: null, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Email already exists');
    }

    if (dto.username && dto.username !== existing.username) {
      const conflict = await this.prisma.user.findFirst({
        where: { institutionId: actor.institutionId!, username: dto.username, deletedAt: null, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Username already exists');
    }

    if (dto.phoneE164 && dto.phoneE164 !== existing.phoneE164) {
      const conflict = await this.prisma.user.findFirst({
        where: { institutionId: actor.institutionId!, phoneE164: dto.phoneE164, deletedAt: null, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Phone already exists');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role ?? undefined,
        email: dto.email ?? undefined,
        username: dto.username ?? undefined,
        phoneE164: dto.phoneE164 ?? undefined,
        passwordHash: passwordHash ?? undefined,
        teacherProfile: dto.teacherProfile
          ? existing.teacherProfile
            ? { update: { ...dto.teacherProfile } }
            : { create: { fullName: dto.teacherProfile.fullName ?? 'Teacher', phone: dto.teacherProfile.phone, specialty: dto.teacherProfile.specialty } }
          : undefined,
        studentProfile: dto.studentProfile
          ? existing.studentProfile
            ? { update: { ...dto.studentProfile } }
            : { create: { fullName: dto.studentProfile.fullName ?? 'Student', contactPhone: dto.studentProfile.contactPhone, gradeLevel: dto.studentProfile.gradeLevel, sectionLabel: dto.studentProfile.sectionLabel } }
          : undefined,
      },
      include: { teacherProfile: true, studentProfile: true },
    });

    return updated;
  }

  async updateStatus(actor: CurrentUser, id: string, dto: UpdateUserStatusDto) {
    this.assertAdmin(actor);
    this.assertTenant(actor);

    if (actor.sub === id && dto.isActive === false) {
      // regla: no te auto-suspendas desde UI (evita lockout)
      throw new UnprocessableEntityException('Cannot suspend yourself');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, institutionId: actor.institutionId!, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Si pasa de active->inactive, revoca sesiones y refresh tokens en transacción
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { isActive: dto.isActive },
        include: { teacherProfile: true, studentProfile: true },
      });

      if (dto.isActive === false) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return u;
    });

    return updated;
  }

  async softDelete(actor: CurrentUser, id: string) {
    this.assertAdmin(actor);
    this.assertTenant(actor);

    if (actor.sub === id) {
      throw new UnprocessableEntityException('Cannot delete yourself');
    }

    const existing = await this.prisma.user.findFirst({
      where: { id, institutionId: actor.institutionId!, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      // Revoca sesiones y refresh tokens
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Soft delete + liberar uniques
      await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          email: null,
          username: null,
          phoneE164: null,
          passwordHash: null,
        },
      });
    });
  }
}
