import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessPolicy } from '../sessions/policies/session-access.policy';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance.query.dto';

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

@Injectable()
export class AttendanceService {
  private readonly policy: SessionAccessPolicy;

  constructor(private readonly prisma: PrismaService) {
    // Reutiliza la policy ya existente (teacher-in-section + section ACTIVE + tenant-safe)
    this.policy = new SessionAccessPolicy(this.prisma);
  }

  private assertHasInstitution(institutionId?: string | null) {
    if (!institutionId) throw new ForbiddenException('Missing institutionId');
  }

  private mapAttendance(row: any) {
    return {
      id: row.id,
      sessionId: row.sessionId,
      studentId: row.studentId,
      status: row.status as AttendanceStatus,
      note: row.note ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Bulk upsert:
   * - dedup por studentId (último gana)
   * - valida: session tenant-safe, teacher in section, enrollments ACTIVE
   * - devuelve counters {created, updated}
   */
  async bulkMark(user: AuthedUser, dto: BulkAttendanceDto) {
    this.assertHasInstitution(user.institutionId);
    const institutionId = user.institutionId!;
    const teacherId = userIdOf(user);

    if (String(user.role) !== 'TEACHER') throw new ForbiddenException('Insufficient role');

    // 1) Deduplicación: último gana por studentId
    const map = new Map<string, { status: AttendanceStatus; note?: string }>();
    for (const it of dto.items) map.set(it.studentId, { status: it.status, note: it.note });

    const normalized = [...map.entries()].map(([studentId, v]) => ({
      studentId,
      status: v.status,
      note: v.note,
    }));

    // 2) Session tenant-safe (404 cross-tenant)
    const session = await this.prisma.session.findFirst({
      where: { id: dto.sessionId, institutionId },
      select: { id: true, sectionId: true },
    });
    if (!session) throw new NotFoundException();

    // 3) Teacher pertenece a sección (policy ya valida Section.status === ACTIVE)
    await this.policy.assertTeacherInSection({
      institutionId,
      teacherId,
      sectionId: session.sectionId,
    });

    // 4) Validar Enrollment ACTIVE SOLO para los studentIds recibidos (eficiente)
    const studentIdsUnique = normalized.map((x) => x.studentId); // ya único por Map
    const found = await this.prisma.enrollment.findMany({
      where: {
        institutionId,
        sectionId: session.sectionId,
        status: 'ACTIVE',
        studentId: { in: studentIdsUnique },
      },
      select: { studentId: true },
    });

    if (found.length !== studentIdsUnique.length) {
      // 422 genérico (sin listar ids)
      throw new UnprocessableEntityException('Student not enrolled in section');
    }

    // 5) Transacción + prefetch para conteo correcto (created/updated)
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findMany({
        where: {
          institutionId,
          sessionId: dto.sessionId,
          studentId: { in: studentIdsUnique },
        },
        select: { studentId: true },
      });
      const existingSet = new Set(existing.map((e) => e.studentId));

      let created = 0;
      let updated = 0;

      for (const item of normalized) {
        const isUpdate = existingSet.has(item.studentId);

        await tx.attendance.upsert({
          where: {
            sessionId_studentId: { sessionId: dto.sessionId, studentId: item.studentId },
          },
          create: {
            institutionId,
            sessionId: dto.sessionId,
            studentId: item.studentId,
            status: item.status,
            note: item.note ?? null,
          },
          update: {
            status: item.status,
            note: item.note ?? null,
          },
        });

        if (isUpdate) updated += 1;
        else created += 1;
      }

      return { data: { created, updated } };
    });
  }

  /**
   * GET attendance por session:
   * - TEACHER: lista completa (si pertenece a sección)
   * - STUDENT: solo su fila (si Enrollment ACTIVE)
   */
  async listBySession(user: AuthedUser, q: ListAttendanceQueryDto) {
    this.assertHasInstitution(user.institutionId);
    const institutionId = user.institutionId!;
    const uid = userIdOf(user);
    const role = String(user.role);

    if (role !== 'TEACHER' && role !== 'STUDENT') throw new ForbiddenException('Insufficient role');

    // Session tenant-safe
    const session = await this.prisma.session.findFirst({
      where: { id: q.sessionId, institutionId },
      select: { id: true, sectionId: true },
    });
    if (!session) throw new NotFoundException();

    if (role === 'TEACHER') {
      await this.policy.assertTeacherInSection({
        institutionId,
        teacherId: uid,
        sectionId: session.sectionId,
      });

      const rows = await this.prisma.attendance.findMany({
        where: { institutionId, sessionId: q.sessionId },
        orderBy: [{ createdAt: 'asc' }],
      });

      return { data: rows.map((r) => this.mapAttendance(r)) };
    }

    // STUDENT: debe estar matriculado ACTIVE (tenant-safe no-leak: 404 si no)
    const enr = await this.prisma.enrollment.findFirst({
      where: {
        institutionId,
        sectionId: session.sectionId,
        studentId: uid,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!enr) throw new NotFoundException();

    const rows = await this.prisma.attendance.findMany({
      where: { institutionId, sessionId: q.sessionId, studentId: uid },
      orderBy: [{ createdAt: 'asc' }],
    });

    return { data: rows.map((r) => this.mapAttendance(r)) };
  }
}
