import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Role, SectionStatus } from '@prisma/client';


import { PrismaService } from '../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ListSectionsQueryDto } from './dto/list-sections.query.dto';
import { SetSectionStatusDto } from './dto/set-section-status.dto';
import { PaginatedSectionsResponseDto, SectionResponseDto } from './dto/section-response.dto';

type CurrentUser = {
  sub: string;
  institutionId: string;
  role: Role;
};

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CurrentUser, dto: CreateSectionDto): Promise<SectionResponseDto> {
    const institutionId = user.institutionId;

    // 1) academicYear tenant-safe -> 404
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, institutionId },
      select: { id: true, name: true },
    });
    if (!academicYear) throw new NotFoundException('AcademicYear not found');

    // 2) subject tenant-safe -> 404
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId },
      select: { id: true, name: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    // 3) teacher tenant-safe y role=TEACHER -> 422
    const teacher = await this.prisma.user.findFirst({
      where: { id: dto.primaryTeacherId, institutionId },
      select: { id: true, email: true, role: true },
    });
    if (!teacher) throw new UnprocessableEntityException('Primary teacher is invalid');
    if (teacher.role !== Role.TEACHER) {
      throw new UnprocessableEntityException('Primary teacher must have role TEACHER');
    }

    try {
      const created = await this.prisma.section.create({
        data: {
          institutionId,
          academicYearId: dto.academicYearId,
          subjectId: dto.subjectId,
          gradeLevel: dto.gradeLevel,
          groupLabel: dto.groupLabel,
          primaryTeacherId: dto.primaryTeacherId,
          status: SectionStatus.ACTIVE, // tu default es ACTIVE, igual lo seteamos explícito
        },
        include: {
          subject: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          primaryTeacher: { select: { id: true, email: true, role: true } },
        },
      });

      return this.toResponse(created);
    } catch (e: any) {
      if (this.isP2002(e)) throw new ConflictException('Section already exists (unique constraint)');
      throw e;
    }
  }

  async findAll(user: CurrentUser, q: ListSectionsQueryDto): Promise<PaginatedSectionsResponseDto> {
    const institutionId = user.institutionId;

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SectionWhereInput = {
      institutionId,
      ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}),
      ...(q.subjectId ? { subjectId: q.subjectId } : {}),
      ...(q.primaryTeacherId ? { primaryTeacherId: q.primaryTeacherId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.gradeLevel ? { gradeLevel: q.gradeLevel } : {}),
    };

    const orderBy: Prisma.SectionOrderByWithRelationInput = {
      [q.sortBy ?? 'createdAt']: q.sortOrder ?? 'desc',
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.section.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          subject: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          primaryTeacher: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.section.count({ where }),
    ]);

    return {
      data: items.map((s) => this.toResponse(s)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(user: CurrentUser, id: string): Promise<SectionResponseDto> {
    const institutionId = user.institutionId;

    const section = await this.prisma.section.findFirst({
      where: { id, institutionId },
      include: {
        subject: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        primaryTeacher: { select: { id: true, email: true, role: true } },
      },
    });

    if (!section) throw new NotFoundException('Section not found');
    return this.toResponse(section);
  }

  async update(user: CurrentUser, id: string, dto: UpdateSectionDto): Promise<SectionResponseDto> {
    const institutionId = user.institutionId;

    // A) ownership tenant-safe -> 404
    const exists = await this.prisma.section.findFirst({
      where: { id, institutionId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Section not found');

    // B) si cambia academicYear/subject -> 404 tenant-safe
    if (dto.academicYearId) {
      const ay = await this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, institutionId },
        select: { id: true },
      });
      if (!ay) throw new NotFoundException('AcademicYear not found');
    }

    if (dto.subjectId) {
      const sub = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, institutionId },
        select: { id: true },
      });
      if (!sub) throw new NotFoundException('Subject not found');
    }

    // C) si cambia teacher -> 422 por rol
    if (dto.primaryTeacherId) {
      const teacher = await this.prisma.user.findFirst({
        where: { id: dto.primaryTeacherId, institutionId },
        select: { id: true, role: true },
      });
      if (!teacher) throw new UnprocessableEntityException('Primary teacher is invalid');
      if (teacher.role !== Role.TEACHER) {
        throw new UnprocessableEntityException('Primary teacher must have role TEACHER');
      }
    }

    try {
      const updated = await this.prisma.section.update({
        where: { id }, // safe porque ya validamos tenant ownership
        data: {
          ...(dto.academicYearId ? { academicYearId: dto.academicYearId } : {}),
          ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
          ...(dto.gradeLevel ? { gradeLevel: dto.gradeLevel } : {}),
          ...(dto.groupLabel ? { groupLabel: dto.groupLabel } : {}),
          ...(dto.primaryTeacherId ? { primaryTeacherId: dto.primaryTeacherId } : {}),
        },
        include: {
          subject: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          primaryTeacher: { select: { id: true, email: true, role: true } },
        },
      });

      return this.toResponse(updated);
    } catch (e: any) {
      if (this.isP2002(e)) throw new ConflictException('Section already exists (unique constraint)');
      throw e;
    }
  }

  async setStatus(user: CurrentUser, id: string, dto: SetSectionStatusDto): Promise<SectionResponseDto> {
    const institutionId = user.institutionId;

    const exists = await this.prisma.section.findFirst({
      where: { id, institutionId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Section not found');

    const updated = await this.prisma.section.update({
      where: { id },
      data: { status: dto.status },
      include: {
        subject: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        primaryTeacher: { select: { id: true, email: true, role: true } },
      },
    });

    return this.toResponse(updated);
  }

  // -------------------------
  // Helpers
  // -------------------------

  private isP2002(e: any): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }

  private toResponse(section: any): SectionResponseDto {
    return {
      id: section.id,
      institutionId: section.institutionId,
      academicYearId: section.academicYearId,
      subjectId: section.subjectId,
      primaryTeacherId: section.primaryTeacherId,
      gradeLevel: section.gradeLevel,
      groupLabel: section.groupLabel,
      status: section.status,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
      subject: section.subject ? { id: section.subject.id, name: section.subject.name } : undefined,
      academicYear: section.academicYear ? { id: section.academicYear.id, name: section.academicYear.name } : undefined,
      primaryTeacher: section.primaryTeacher
        ? { id: section.primaryTeacher.id, email: section.primaryTeacher.email ?? null, role: section.primaryTeacher.role }
        : undefined,
    };
  }
}
