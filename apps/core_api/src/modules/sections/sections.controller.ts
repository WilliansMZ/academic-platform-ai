import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ListSectionsQueryDto } from './dto/list-sections.query.dto';
import { SetSectionStatusDto } from './dto/set-section-status.dto';
import { PaginatedSectionsResponseDto, SectionResponseDto } from './dto/section-response.dto';

// Ajusta a tus paths reales (usa los mismos que en Subjects)
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';

@ApiTags('Sections')
@ApiBearerAuth('access-token')
@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN)
  @ApiOperation({ summary: 'Crear Section (Admin-only)' })
  @ApiResponse({ status: 201, type: SectionResponseDto })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404, description: 'AcademicYear/Subject no existe (tenant-safe)' })
  @ApiResponse({ status: 409, description: 'Unique conflict (Section duplicada)' })
  @ApiResponse({ status: 422, description: 'PrimaryTeacher inválido o rol != TEACHER' })
  create(@CurrentUser() user: any, @Body() dto: CreateSectionDto) {
    return this.sectionsService.create(user, dto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN)
  @ApiOperation({ summary: 'Listar Sections (Admin-only) con filtros + paginación' })
  @ApiResponse({ status: 200, type: PaginatedSectionsResponseDto })
  findAll(@CurrentUser() user: any, @Query() q: ListSectionsQueryDto) {
    return this.sectionsService.findAll(user, q);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  @ApiOperation({ summary: 'Detalle de Section por ID (Admin-only)' })
  @ApiResponse({ status: 200, type: SectionResponseDto })
  @ApiResponse({ status: 404, description: 'No existe o cross-tenant' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.sectionsService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  @ApiOperation({ summary: 'Actualizar Section (Admin-only)' })
  @ApiResponse({ status: 200, type: SectionResponseDto })
  @ApiResponse({ status: 404, description: 'No existe o cross-tenant' })
  @ApiResponse({ status: 409, description: 'Unique conflict (Section duplicada)' })
  @ApiResponse({ status: 422, description: 'PrimaryTeacher inválido o rol != TEACHER' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(user, id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.INSTITUTION_ADMIN)
  @ApiOperation({ summary: 'Cambiar status de Section (Admin-only)' })
  @ApiResponse({ status: 200, type: SectionResponseDto })
  @ApiResponse({ status: 404, description: 'No existe o cross-tenant' })
  setStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SetSectionStatusDto) {
    return this.sectionsService.setStatus(user, id, dto);
  }
}
