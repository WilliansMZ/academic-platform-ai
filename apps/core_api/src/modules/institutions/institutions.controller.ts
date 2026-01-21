import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/auth/decorators/roles.decorator';
import { RolesGuard } from '../../common/auth/guards/roles.guard';

import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { ListInstitutionsQueryDto } from './dto/list-institutions.query.dto';
import { InstitutionResponseDto } from './dto/institution-response.dto';
import { InstitutionsService } from './institutions.service';
import { ParseUUIDPipe } from '@nestjs/common';



@ApiTags('Institutions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
@Controller('api/v1/institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create institution (tenant root)' })
  @ApiResponse({ status: 201, type: InstitutionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  create(@Body() dto: CreateInstitutionDto) {
    return this.institutions.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get institution by id' })
  @ApiParam({ name: 'id', description: 'Institution UUID' })
  @ApiResponse({ status: 200, type: InstitutionResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })

  getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
  return this.institutions.getById(id);
}

  @Get()
  @ApiOperation({ summary: 'List institutions with pagination/filters' })
  @ApiResponse({ status: 200 })
  list(@Query() query: ListInstitutionsQueryDto) {
    return this.institutions.list(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update institution (includes activate/suspend)' })
  @ApiResponse({ status: 200, type: InstitutionResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })

  update(
  @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  @Body() dto: UpdateInstitutionDto,
) {
  return this.institutions.update(id, dto);
}
}
