import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateTeacherProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  specialty?: string;
}

class UpdateStudentProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  gradeLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  sectionLabel?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: Role, description: 'No permitir SUPERADMIN desde tenant' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;

  @ApiPropertyOptional({ description: 'E.164 +51999999999' })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  @Matches(/^\+?[1-9]\d{7,19}$/)
  phoneE164?: string;

  @ApiPropertyOptional({ description: 'Change password' })
  @IsOptional()
  @IsString()
  @Length(8, 72)
  password?: string;

  @ApiPropertyOptional({ type: UpdateTeacherProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTeacherProfileDto)
  teacherProfile?: UpdateTeacherProfileDto;

  @ApiPropertyOptional({ type: UpdateStudentProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateStudentProfileDto)
  studentProfile?: UpdateStudentProfileDto;
}
