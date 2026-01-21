import { ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateInstitutionDto {
  @ApiPropertyOptional({ example: 'Nuevo Nombre', minLength: 3, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  name?: string;

  @ApiPropertyOptional({ example: 'nuevo-slug', minLength: 3, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(3, 60)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must match ^[a-z0-9-]+$' })
  slug?: string;

  @ApiPropertyOptional({ enum: InstitutionStatus, example: InstitutionStatus.SUSPENDED })
  @IsOptional()
  @IsEnum(InstitutionStatus)
  status?: InstitutionStatus;
}
