import { ApiProperty } from '@nestjs/swagger';
import { SectionStatus } from '@prisma/client';

export class MyCourseSectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  gradeLevel!: string;

  @ApiProperty()
  groupLabel!: string;

  @ApiProperty({ enum: SectionStatus })
  status!: SectionStatus;
}

export class MyCourseSubjectDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class MyCourseAcademicYearDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class MyCourseItemDto {
  @ApiProperty({ type: MyCourseSectionDto })
  section!: MyCourseSectionDto;

  @ApiProperty({ type: MyCourseSubjectDto })
  subject!: MyCourseSubjectDto;

  @ApiProperty({ type: MyCourseAcademicYearDto })
  academicYear!: MyCourseAcademicYearDto;

  @ApiProperty({ enum: ['TEACHER', 'STUDENT'] })
  myRole!: 'TEACHER' | 'STUDENT';
}
