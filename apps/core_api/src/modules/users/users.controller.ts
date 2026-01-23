import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserDetailResponseDto } from './dto/user-detail-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMapper } from './mappers/user.mapper';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { CurrentUser as CurrentUserDecorator } from '../../common/auth/decorators/current-user.decorator';


import type { CurrentUser } from './users.types';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Create user in current institution' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @Roles(Role.INSTITUTION_ADMIN)
  @Post()
  async create(
    @CurrentUserDecorator() actor: CurrentUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.create(actor, dto);
    return UserMapper.toResponse(user);
  }

  @ApiOperation({ summary: 'Get my profile' })
  @ApiResponse({ status: 200, type: UserDetailResponseDto })
  @Get('me')
  async me(@CurrentUserDecorator() actor: CurrentUser): Promise<UserDetailResponseDto> {
    const user = await this.usersService.me(actor);
    return UserMapper.toDetailResponse(user);
  }

  @ApiOperation({ summary: 'Get user by id (tenant-scoped)' })
  @ApiResponse({ status: 200, type: UserDetailResponseDto })
  @Roles(Role.INSTITUTION_ADMIN)
  @Get(':id')
  async getById(
    @CurrentUserDecorator() actor: CurrentUser,
    @Param('id') id: string,
  ): Promise<UserDetailResponseDto> {
    const user = await this.usersService.getById(actor, id);
    return UserMapper.toDetailResponse(user);
  }

  @ApiOperation({ summary: 'List users (tenant-scoped) with pagination and filters' })
  @ApiResponse({ status: 200 })
  @Roles(Role.INSTITUTION_ADMIN)
  @Get()
  async list(@CurrentUserDecorator() actor: CurrentUser, @Query() query: ListUsersQueryDto) {
    const result = await this.usersService.list(actor, query);
    return {
      data: result.data.map(UserMapper.toResponse),
      meta: result.meta,
    };
  }

  @ApiOperation({ summary: 'Update user (tenant-scoped)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @Roles(Role.INSTITUTION_ADMIN)
  @Patch(':id')
  async update(
    @CurrentUserDecorator() actor: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(actor, id, dto);
    return UserMapper.toResponse(user);
  }

  @ApiOperation({ summary: 'Suspend/activate user (tenant-scoped). Suspended users get sessions/tokens revoked.' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @Roles(Role.INSTITUTION_ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @CurrentUserDecorator() actor: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.updateStatus(actor, id, dto);
    return UserMapper.toResponse(user);
  }

  @ApiOperation({ summary: 'Soft delete user (tenant-scoped). Releases unique identifiers and revokes sessions/tokens.' })
  @ApiResponse({ status: 204 })
  @Roles(Role.INSTITUTION_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT) // ✅ fuerza 204
  @Delete(':id')
  async softDelete(@CurrentUserDecorator() actor: CurrentUser, @Param('id') id: string): Promise<void> {
    await this.usersService.softDelete(actor, id);
  }
}
