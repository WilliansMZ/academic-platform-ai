import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateSectionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  gradeLevel?: string;

  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  groupLabel?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  primaryTeacherId?: string;
}
