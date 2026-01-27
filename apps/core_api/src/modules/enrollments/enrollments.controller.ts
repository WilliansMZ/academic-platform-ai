import { Controller, Get, Param, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListEnrollmentsQueryDto } from './dto/list-enrollments.query.dto';
import { SetEnrollmentStatusDto } from './dto/set-enrollment-status.dto';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { access } from 'fs/promises';

@ApiTags('Enrollments')
@ApiBearerAuth('access-token')
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.INSTITUTION_ADMIN) // (si quieres permitir SUPERADMIN: ajusta Roles decorator)
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Post()
  @ApiResponse({ status: 201, description: 'Enrollment created' })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 409 })
  @ApiResponse({ status: 422 })
  create(@CurrentUser() user: any, @Body() dto: CreateEnrollmentDto) {
    return this.service.create(user, dto);
  }

  @Get()
  @ApiResponse({ status: 200, description: 'Enrollments list' })
  list(@CurrentUser() user: any, @Query() query: ListEnrollmentsQueryDto) {
    return this.service.list(user, query);
  }

  @Patch(':id/status')
  @ApiResponse({ status: 200, description: 'Enrollment status updated' })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  @ApiResponse({ status: 422 })
  setStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SetEnrollmentStatusDto,
  ) {
    return this.service.setStatus(user, id, dto);
  }
}
