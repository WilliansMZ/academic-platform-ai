import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstitutionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { ListInstitutionsQueryDto } from './dto/list-institutions.query.dto';
import { InstitutionResponseDto } from './dto/institution-response.dto';
import { PaginatedResponse } from './institutions.types';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(i: any): InstitutionResponseDto {
    return {
      id: i.id,
      name: i.name,
      slug: i.slug,
      status: i.status,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }

  async create(dto: CreateInstitutionDto): Promise<InstitutionResponseDto> {
    // Conflictos (slug siempre unique; name depende si lo hiciste unique, pero igual lo podemos validar)
    const conflict = await this.prisma.institution.findFirst({
      where: { OR: [{ slug: dto.slug }, { name: dto.name }] },
      select: { id: true, slug: true, name: true },
    });

    if (conflict?.slug === dto.slug) throw new ConflictException('Institution slug already exists');
    if (conflict?.name === dto.name) throw new ConflictException('Institution name already exists');

    try {
      const created = await this.prisma.institution.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          status: InstitutionStatus.ACTIVE,
        },
      });
      return this.toResponse(created);
    } catch (e: any) {
      // fallback por si Prisma dispara unique constraint
      if (e?.code === 'P2002') throw new ConflictException('Institution already exists');
      throw e;
    }
  }

  async getById(id: string): Promise<InstitutionResponseDto> {
    const inst = await this.prisma.institution.findUnique({ where: { id } });
    if (!inst) throw new NotFoundException('Institution not found');
    return this.toResponse(inst);
  }

  async list(query: ListInstitutionsQueryDto): Promise<PaginatedResponse<InstitutionResponseDto>> {
    const { page, pageSize, status, search, sortBy, sortOrder } = query;

    const where: Prisma.InstitutionWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.institution.count({ where }),
      this.prisma.institution.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return {
      data: rows.map((r) => this.toResponse(r)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async update(id: string, dto: UpdateInstitutionDto): Promise<InstitutionResponseDto> {
    const existing = await this.prisma.institution.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Institution not found');

    // Conflictos por slug
    if (dto.slug && dto.slug !== existing.slug) {
      const slugTaken = await this.prisma.institution.findUnique({ where: { slug: dto.slug } });
      if (slugTaken) throw new ConflictException('Institution slug already exists');
    }

    // Conflictos por name (aunque no sea unique en DB, lo tratamos como regla de dominio)
    if (dto.name && dto.name !== existing.name) {
      const nameTaken = await this.prisma.institution.findFirst({
        where: { name: dto.name, NOT: { id } },
        select: { id: true },
      });
      if (nameTaken) throw new ConflictException('Institution name already exists');
    }

    // Cambio a SUSPENDED => cascada opcional (recomendado)
    const willSuspend =
      dto.status === InstitutionStatus.SUSPENDED &&
      existing.status !== InstitutionStatus.SUSPENDED;

    if (willSuspend) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.institution.update({ where: { id }, data: dto }),
        this.prisma.user.updateMany({
          where: { institutionId: id, isActive: true, deletedAt: null },
          data: { isActive: false },
        }),
      ]);
      return this.toResponse(updated);
    }

    try {
      const updated = await this.prisma.institution.update({ where: { id }, data: dto });
      return this.toResponse(updated);
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Institution conflict');
      throw e;
    }
  }
}
