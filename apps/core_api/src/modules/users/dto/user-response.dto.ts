import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() institutionId?: string | null;

  @ApiProperty({ enum: Role }) role!: Role;

  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() username?: string | null;
  @ApiPropertyOptional() phoneE164?: string | null;

  @ApiProperty() isActive!: boolean;

  // ✅ ISO string
  @ApiPropertyOptional({ example: '2026-01-22T21:16:27.000Z' })
  lastLoginAt?: string | null;

  // ✅ ISO string
  @ApiProperty({ example: '2026-01-22T21:16:27.000Z' })
  createdAt!: string;

  // ✅ ISO string
  @ApiProperty({ example: '2026-01-22T21:16:27.000Z' })
  updatedAt!: string;
}
