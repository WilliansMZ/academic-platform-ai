import { Body, Controller, Get, Param, Patch, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard'; // ajusta path
import { RolesGuard } from '../../common/auth/guards/roles.guard'; // ajusta path
import { Roles } from '../../common/auth/decorators/roles.decorator'; // ajusta path
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator'; // ajusta path
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects.query.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { PaginatedSubjectsResponseDto } from './dto/paginated-subjects-response.dto';
import { SubjectsService } from './subjects.service';
import { UseGuards } from '@nestjs/common';

@ApiTags('Subjects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.INSTITUTION_ADMIN)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Subject (course/materia) within tenant' })
  @ApiResponse({ status: 201, type: SubjectResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict (duplicate subject name)' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateSubjectDto,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.create(
      { id: user.id ?? user.sub, role: user.role, institutionId: user.institutionId },
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List subjects (paginated) for current tenant' })
  @ApiResponse({ status: 200, type: PaginatedSubjectsResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @CurrentUser() user: any,
    @Query() query: ListSubjectsQueryDto,
  ): Promise<PaginatedSubjectsResponseDto> {
    return this.subjectsService.list(
      { id: user.id ?? user.sub, role: user.role, institutionId: user.institutionId },
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subject detail by id (tenant-scoped)' })
  @ApiResponse({ status: 200, type: SubjectResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found (missing or cross-tenant)' })
  async getById(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.getById(
      { id: user.id ?? user.sub, role: user.role, institutionId: user.institutionId },
      id,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update subject partially (tenant-scoped)' })
  @ApiResponse({ status: 200, type: SubjectResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found (missing or cross-tenant)' })
  @ApiResponse({ status: 409, description: 'Conflict (duplicate subject name)' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.update(
      { id: user.id ?? user.sub, role: user.role, institutionId: user.institutionId },
      id,
      dto,
    );
  }
}
