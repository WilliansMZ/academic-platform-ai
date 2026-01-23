import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

class TeacherProfileDto {
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() specialty?: string | null;
}

class StudentProfileDto {
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() contactPhone?: string | null;
  @ApiPropertyOptional() gradeLevel?: string | null;
  @ApiPropertyOptional() sectionLabel?: string | null;
}

export class UserDetailResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() institutionId?: string | null;

  @ApiProperty({ enum: Role }) role!: Role;

  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() username?: string | null;
  @ApiPropertyOptional() phoneE164?: string | null;

  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() lastLoginAt?: string | null;

  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  @ApiPropertyOptional({ type: TeacherProfileDto })
  teacherProfile?: TeacherProfileDto | null;

  @ApiPropertyOptional({ type: StudentProfileDto })
  studentProfile?: StudentProfileDto | null;
}
