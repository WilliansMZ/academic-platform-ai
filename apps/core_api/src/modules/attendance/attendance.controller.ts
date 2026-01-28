import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import type { AccessTokenPayload } from '../../common/auth/types/jwt-payload.type';

import { AttendanceService } from './attendance.service';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance.query.dto';

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('bulk')
  @Roles(Role.TEACHER)
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Bulk upsert attendance (create/update). Returns counters.',
    schema: { example: { data: { created: 1, updated: 0 } } },
  })
  @ApiBadRequestResponse({ description: 'DTO validation error' })
  @ApiForbiddenResponse({ description: 'Insufficient role / missing institutionId' })
  @ApiNotFoundResponse({ description: 'Tenant-safe: session not found or teacher not in section' })
  @ApiUnprocessableEntityResponse({ description: 'Domain rule violated (generic)' })
  bulkMark(@CurrentUser() user: AccessTokenPayload, @Body() dto: BulkAttendanceDto) {
    return this.attendanceService.bulkMark(user, dto);
  }

  @Get()
  @Roles(Role.TEACHER, Role.STUDENT)
  @ApiOkResponse({
    description: 'List attendance for a session. Teacher sees all, student sees only own row.',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            sessionId: 'uuid',
            studentId: 'uuid',
            status: 'LATE',
            note: 'Llegó tarde',
            createdAt: '2026-01-28T02:46:59.317Z',
            updatedAt: '2026-01-28T02:47:33.888Z',
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Query validation error' })
  @ApiForbiddenResponse({ description: 'Insufficient role / missing institutionId' })
  @ApiNotFoundResponse({ description: 'Tenant-safe: session not found / not allowed' })
  listBySession(@CurrentUser() user: AccessTokenPayload, @Query() q: ListAttendanceQueryDto) {
    return this.attendanceService.listBySession(user, q);
  }
}
