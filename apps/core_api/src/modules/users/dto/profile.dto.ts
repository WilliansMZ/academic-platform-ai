import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateTeacherProfileDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiPropertyOptional({ example: '+51999999999' })
  @IsOptional()
  @IsString()
  @Length(6, 30)
  phone?: string;

  @ApiPropertyOptional({ example: 'Matemáticas' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  specialty?: string;
}

export class CreateStudentProfileDto {
  @ApiPropertyOptional({ example: 'Ana Torres' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiPropertyOptional({ example: '+51999999999' })
  @IsOptional()
  @IsString()
  @Length(6, 30)
  contactPhone?: string;

  @ApiPropertyOptional({ example: '3° Secundaria' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  gradeLevel?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  sectionLabel?: string;
}
