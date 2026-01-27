import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListEnrollmentsQueryDto } from './dto/list-enrollments.query.dto';
import { SetEnrollmentStatusDto } from './dto/set-enrollment-status.dto';
import { EnrollmentStatus, Role, SectionStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

type CurrentUser = {
  sub: string;
  institutionId?: string | null;
  role: Role;
};

function buildMeta(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, totalPages };
}

const enrollmentInclude = {
  student: {
    select: {
      id: true,
      role: true,
      email: true,
      username: true,
      studentProfile: {
        select: { fullName: true },
      },
    },
  },
  section: {
    select: {
      id: true,
      gradeLevel: true,
      groupLabel: true,
      status: true,
      subject: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EnrollmentInclude;

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(currentUser: CurrentUser, dto: CreateEnrollmentDto) {
    const institutionId = currentUser.institutionId;
    if (!institutionId) {
      // en tu sistema, SUPERADMIN podría no tener institutionId.
      // Para Sprint 3, este módulo es tenant-plane, así que exigimos tenant.
      throw new UnprocessableEntityException('Missing institution context');
    }

    return this.prisma.$transaction(async (tx) => {
      const section = await tx.section.findFirst({
        where: { id: dto.sectionId, institutionId },
        select: { id: true, status: true },
      });
      if (!section) throw new NotFoundException('Section not found');

      if (section.status === SectionStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Cannot enroll into an archived section');
      }

      const student = await tx.user.findFirst({
        where: { id: dto.studentId, institutionId },
        select: { id: true, role: true },
      });

      // Regla de dominio: student inválido (no existe en tenant o rol incorrecto) => 422
      if (!student || student.role !== Role.STUDENT) {
        throw new UnprocessableEntityException('Invalid student for enrollment');
      }

      try {
        const created = await tx.enrollment.create({
          data: {
            institutionId,
            sectionId: dto.sectionId,
            studentId: dto.studentId,
            status: EnrollmentStatus.ACTIVE,
          },
          include: enrollmentInclude,
        });
        return created;
      } catch (e: any) {
        // Unique violation: @@unique([sectionId, studentId])
        if (this.isPrismaUniqueError(e)) {
          throw new ConflictException('Student already enrolled in this section');
        }
        throw e;
      }
    });
  }

  async list(currentUser: CurrentUser, query: ListEnrollmentsQueryDto) {
    const institutionId = currentUser.institutionId;
    if (!institutionId) {
      throw new UnprocessableEntityException('Missing institution context');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.EnrollmentWhereInput = {
      institutionId,
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.findMany({
        where,
        skip,
        take,
        orderBy: { enrolledAt: 'desc' },
        include: enrollmentInclude,
      }),
    ]);

    return { data, meta: buildMeta(page, pageSize, total) };
  }

  async setStatus(currentUser: CurrentUser, id: string, dto: SetEnrollmentStatusDto) {
    const institutionId = currentUser.institutionId;
    if (!institutionId) {
      throw new UnprocessableEntityException('Missing institution context');
    }

    const existing = await this.prisma.enrollment.findFirst({
      where: { id, institutionId },
      select: { id: true, sectionId: true },
    });
    if (!existing) throw new NotFoundException('Enrollment not found');

    // Opcional (senior): si reactivas, validar que la Section no esté ARCHIVED
    if (dto.status === EnrollmentStatus.ACTIVE) {
      const section = await this.prisma.section.findFirst({
        where: { id: existing.sectionId, institutionId },
        select: { status: true },
      });
      if (!section) throw new NotFoundException('Section not found');
      if (section.status === SectionStatus.ARCHIVED) {
        throw new UnprocessableEntityException('Cannot reactivate enrollment for an archived section');
      }
    }

    return this.prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: dto.status },
      include: enrollmentInclude,
    });
  }

  private isPrismaUniqueError(e: unknown): boolean {
    return (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    );
  }
}
