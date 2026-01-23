import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service'; // ajusta si tu path difiere
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects.query.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectsMapper } from './mappers/subjects.mapper';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { PaginatedSubjectsResponseDto } from './dto/paginated-subjects-response.dto';

type Actor = {
  id: string; // o sub, según tu auth
  role: Role;
  institutionId: string;
};

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(actor: Actor, dto: CreateSubjectDto): Promise<SubjectResponseDto> {
    try {
      const created = await this.prisma.subject.create({
        data: {
          institutionId: actor.institutionId,
          name: dto.name.trim(),
        },
      });

      // Auditoría mínima
      this.logger.log(
        JSON.stringify({
          action: 'SUBJECT_CREATED',
          actorId: actor.id,
          institutionId: actor.institutionId,
          subjectId: created.id,
        }),
      );

      return SubjectsMapper.toResponse(created);
    } catch (err) {
      if (this.isUniqueConstraint(err)) {
        throw new ConflictException('Subject name already exists in this institution.');
      }
      throw err;
    }
  }

  async list(actor: Actor, query: ListSubjectsQueryDto): Promise<PaginatedSubjectsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SubjectWhereInput = {
      institutionId: actor.institutionId,
      ...(query.search
        ? {
            name: {
              contains: query.search.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const orderBy: Prisma.SubjectOrderByWithRelationInput =
      query.sortBy === 'name'
        ? { name: query.sortOrder ?? 'asc' }
        : { createdAt: query.sortOrder ?? 'desc' };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: items.map(SubjectsMapper.toResponse),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async getById(actor: Actor, id: string): Promise<SubjectResponseDto> {
    const subject = await this.prisma.subject.findFirst({
      where: { id, institutionId: actor.institutionId },
    });

    if (!subject) {
      // 404 tanto si no existe como si es cross-tenant
      throw new NotFoundException('Subject not found.');
    }

    return SubjectsMapper.toResponse(subject);
  }

  async update(actor: Actor, id: string, dto: UpdateSubjectDto): Promise<SubjectResponseDto> {
    const data: Prisma.SubjectUpdateManyMutationInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    try {
      const result = await this.prisma.subject.updateMany({
        where: { id, institutionId: actor.institutionId },
        data,
      });

      if (result.count === 0) {
        throw new NotFoundException('Subject not found.');
      }

      const updated = await this.prisma.subject.findFirst({
        where: { id, institutionId: actor.institutionId },
      });

      // Por consistencia, si updateMany pasó, esto debería existir
      if (!updated) throw new NotFoundException('Subject not found.');

      return SubjectsMapper.toResponse(updated);
    } catch (err) {
      if (this.isUniqueConstraint(err)) {
        throw new ConflictException('Subject name already exists in this institution.');
      }
      throw err;
    }
  }

  // Si más adelante agregas DELETE, hazlo con deleteMany + count y 404.

  private isUniqueConstraint(err: unknown): boolean {
    // Prisma P2002 = unique constraint failed
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as any).code === 'P2002'
    );
  }
}
