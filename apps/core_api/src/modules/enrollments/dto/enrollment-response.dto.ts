import { ApiProperty } from '@nestjs/swagger';
import { EnrollmentStatus, SectionStatus } from '@prisma/client';

class SubjectDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

class AcademicYearDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

class SectionDto {
  @ApiProperty() id!: string;
  @ApiProperty() gradeLevel!: string;
  @ApiProperty() groupLabel!: string;
  @ApiProperty({ enum: SectionStatus }) status!: SectionStatus;

  @ApiProperty({ type: SubjectDto }) subject!: SubjectDto;
  @ApiProperty({ type: AcademicYearDto }) academicYear!: AcademicYearDto;
}

class StudentProfileDto {
  @ApiProperty() fullName!: string;
}

class StudentDto {
  @ApiProperty() id!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ required: false, nullable: true }) email?: string | null;
  @ApiProperty({ required: false, nullable: true }) username?: string | null;

  @ApiProperty({ required: false, type: StudentProfileDto, nullable: true })
  studentProfile?: StudentProfileDto | null;
}

export class EnrollmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: EnrollmentStatus }) status!: EnrollmentStatus;
  @ApiProperty() enrolledAt!: Date;
  @ApiProperty() createdAt!: Date;

  @ApiProperty({ type: StudentDto }) student!: StudentDto;
  @ApiProperty({ type: SectionDto }) section!: SectionDto;
}
