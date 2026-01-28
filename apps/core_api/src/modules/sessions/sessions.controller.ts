import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions.query.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionResponseDto } from './dto/session-response.dto';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';

// ✅ Envelopes Swagger
class DataEnvelope<T> {
  data!: T;
}

class MetaDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

class PaginatedEnvelope<T> {
  data!: T[];
  meta!: MetaDto;
}

@ApiTags('Sessions')
@ApiBearerAuth('access-token') // ✅ si tu Swagger config usa name distinto, pon el mismo aquí
@ApiExtraModels(SessionResponseDto, MetaDto, DataEnvelope, PaginatedEnvelope)
@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @Roles('TEACHER')
  @ApiOperation({ summary: 'Create a session (Teacher only)' })
  @ApiCreatedResponse({
    description: 'Session created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(DataEnvelope) },
        {
          properties: {
            data: { $ref: getSchemaPath(SessionResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'DTO validation failed' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid token' })
  @ApiForbiddenResponse({ description: 'Role/policy forbids access' })
  @ApiNotFoundResponse({ description: 'Section/Period not found (tenant-safe)' })
  @ApiConflictResponse({ description: 'Unique constraint (duplicate session date)' })
  create(@CurrentUser() user: any, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user, dto);
  }

  @Get()
  @Roles('TEACHER', 'STUDENT')
  @ApiOperation({ summary: 'List sessions (Teacher/Student)' })
  @ApiOkResponse({
    description: 'Paginated list',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedEnvelope) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(SessionResponseDto) },
            },
            meta: { $ref: getSchemaPath(MetaDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Query validation failed' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid token' })
  @ApiForbiddenResponse({ description: 'Role/policy forbids access' })
  findMany(@CurrentUser() user: any, @Query() query: ListSessionsQueryDto) {
    return this.sessions.findMany(user, query);
  }

  @Get(':id')
  @Roles('TEACHER', 'STUDENT')
  @ApiOperation({ summary: 'Get session by id (Teacher/Student)' })
  @ApiOkResponse({
    description: 'Session found',
    schema: {
      allOf: [
        { $ref: getSchemaPath(DataEnvelope) },
        {
          properties: {
            data: { $ref: getSchemaPath(SessionResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid token' })
  @ApiForbiddenResponse({ description: 'Role/policy forbids access' })
  @ApiNotFoundResponse({ description: 'Not found (tenant-safe) or not visible for student' })
  findOne(@CurrentUser() user: any, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.sessions.findOne(user, id);
  }

  @Patch(':id')
  @Roles('TEACHER')
  @ApiOperation({ summary: 'Update session (Teacher only)' })
  @ApiOkResponse({
    description: 'Session updated',
    schema: {
      allOf: [
        { $ref: getSchemaPath(DataEnvelope) },
        {
          properties: {
            data: { $ref: getSchemaPath(SessionResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid UUID / DTO validation failed' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid token' })
  @ApiForbiddenResponse({ description: 'Role/policy forbids access' })
  @ApiNotFoundResponse({ description: 'Session not found (tenant-safe)' })
  @ApiConflictResponse({ description: 'Unique constraint (duplicate session date)' })
  update(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessions.update(user, id, dto);
  }
}
