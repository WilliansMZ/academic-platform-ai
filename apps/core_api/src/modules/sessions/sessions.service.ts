import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions.query.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionAccessPolicy } from './policies/session-access.policy';

type AuthedUser = {
  id?: string;
  sub?: string;
  role: Role | string;
  institutionId?: string | null;
};

function userIdOf(u: AuthedUser): string {
  const id = u.id ?? u.sub;
  if (!id) throw new ForbiddenException('Invalid token payload (missing sub/id)');
  return id;
}

function toUtcDateOnly(dateStr: string): Date {
  // Para @db.Date: guarda a medianoche UTC para evitar shifts por TZ
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new UnprocessableEntityException('Invalid date');
  return d;
}

function toISODateOnlyUTC(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Injectable()
export class SessionsService {
  private readonly policy: SessionAccessPolicy;

  constructor(private readonly prisma: PrismaService) {
    this.policy = new SessionAccessPolicy(this.prisma);
  }

  private assertHasInstitution(institutionId?: string | null) {
    if (!institutionId) throw new ForbiddenException('Missing institutionId');
  }

  private mapSession(row: any) {
    return {
      id: row.id,
      institutionId: row.institutionId,
      sectionId: row.sectionId,
      periodId: row.periodId ?? null,

      // 👇 academicYearId NO existe en Session, lo calculamos si vino incluido
      academicYearId: row.section?.academicYearId ?? null,

      sessionDate: toISODateOnlyUTC(row.sessionDate),
      weekLabel: row.weekLabel ?? null,
      topicTitle: row.topicTitle,
      topicDescription: row.topicDescription ?? null,

      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(user: AuthedUser, dto: CreateSessionDto) {
    this.assertHasInstitution(user.institutionId);
    const institutionId = user.institutionId!;
    const uid = userIdOf(user);

    if (String(user.role) !== 'TEACHER') throw new ForbiddenException();

    // 1) Teacher debe pertenecer a la sección + sección ACTIVE
    await this.policy.assertTeacherInSection({
      institutionId,
      teacherId: uid,
      sectionId: dto.sectionId,
    });

    // 2) section tenant-safe -> 404
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, institutionId },
      select: { id: true },
    });
    if (!section) throw new NotFoundException('Section not found');

    // 3) period tenant-safe -> 404 (si viene)
    if (dto.periodId) {
      const period = await this.prisma.period.findFirst({
        where: { id: dto.periodId, institutionId },
        select: { id: true },
      });
      if (!period) throw new NotFoundException('Period not found');
    }

    try {
      const created = await this.prisma.session.create({
        data: {
          institutionId,
          sectionId: dto.sectionId,
          periodId: dto.periodId ?? null,
          sessionDate: toUtcDateOnly(dto.sessionDate),
          weekLabel: dto.weekLabel ?? null,
          topicTitle: dto.topicTitle,
          topicDescription: dto.topicDescription ?? null,
          createdBy: uid,
        },
        include: {
          section: { select: { academicYearId: true } }, // ✅ para devolver academicYearId calculado
        },
      });

      return { data: this.mapSession(created) };
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Session already exists for that date');
      }
      throw e;
    }
  }

  async findMany(user: AuthedUser, q: ListSessionsQueryDto) {
    this.assertHasInstitution(user.institutionId);
    const institutionId = user.institutionId!;
    const uid = userIdOf(user);
    const role = String(user.role);

    if (role !== 'TEACHER' && role !== 'STUDENT') throw new ForbiddenException();

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where: Prisma.SessionWhereInput = {
      institutionId,
      ...(q.sectionId ? { sectionId: q.sectionId } : {}),
    };

    if (q.from || q.to) {
      where.sessionDate = {};
      if (q.from) (where.sessionDate as any).gte = toUtcDateOnly(q.from);
      if (q.to) (where.sessionDate as any).lte = toUtcDateOnly(q.to);
    }

    // Scope por rol
    if (role === 'TEACHER') {
      where.section = {
        OR: [
          { primaryTeacherId: uid },
          { teachers: { some: { teacherId: uid } } },
        ],
      };
    }

    if (role === 'STUDENT') {
      where.section = {
        enrollments: {
          some: {
            institutionId,
            studentId: uid,
            status: 'ACTIVE',
          },
        },
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.session.count({ where }),
      this.prisma.session.findMany({
        where,
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          section: { select: { academicYearId: true } }, // ✅ para devolver academicYearId calculado
        },
      }),
    ]);

    return {
      data: rows.map((r) => this.mapSession(r)),
      meta: { page, pageSize, total },
    };
  }

  async findOne(user: AuthedUser, id: string) {
    this.assertHasInstitution(user.institutionId);
    const institutionId = user.institutionId!;
    const uid = userIdOf(user);
    const role = String(user.role);

    if (role !== 'TEACHER' && role !== 'STUDENT') throw new ForbiddenException();

    if (role === 'TEACHER') {
      await this.policy.assertTeacherCanManageSession({
        institutionId,
        teacherId: uid,
        sessionId: id,
      });
    } else {
      await this.policy.assertStudentCanViewSession({
        institutionId,
        studentId: uid,
        sessionId: id,
      });
    }

    const session = await this.prisma.session.findFirst({
      where: { id, institutionId },
      include: { section: { select: { academicYearId: true } } },
    });
    if (!session) throw new NotFoundException();

    return { data: this.mapSession(session) };
  }

  async update(user: AuthedUser, id: string, dto: UpdateSessionDto) {
    this.assertHasInstitution(user.institutionId);
    const institutionId = user.institutionId!;
    const uid = userIdOf(user);

    if (String(user.role) !== 'TEACHER') throw new ForbiddenException();

    await this.policy.assertTeacherCanManageSession({
      institutionId,
      teacherId: uid,
      sessionId: id,
    });

    // Verificar que existe en el tenant (evita update cross-tenant)
    const exists = await this.prisma.session.findFirst({
      where: { id, institutionId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException();

    // period tenant-safe si viene definido
    if (dto.periodId !== undefined && dto.periodId !== null) {
      const period = await this.prisma.period.findFirst({
        where: { id: dto.periodId, institutionId },
        select: { id: true },
      });
      if (!period) throw new NotFoundException('Period not found');
    }

    try {
      const updated = await this.prisma.session.update({
        where: { id }, // ✅ seguro porque validamos ownership arriba
        data: {
          periodId: dto.periodId === undefined ? undefined : dto.periodId,
          sessionDate: dto.sessionDate ? toUtcDateOnly(dto.sessionDate) : undefined,
          weekLabel: dto.weekLabel === undefined ? undefined : dto.weekLabel,
          topicTitle: dto.topicTitle ?? undefined,
          topicDescription: dto.topicDescription === undefined ? undefined : dto.topicDescription,
        },
        include: { section: { select: { academicYearId: true } } },
      });

      return { data: this.mapSession(updated) };
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Session already exists for that date');
      }
      throw e;
    }
  }
}
