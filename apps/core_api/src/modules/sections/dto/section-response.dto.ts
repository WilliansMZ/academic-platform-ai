import { ApiProperty } from '@nestjs/swagger';
import { SectionStatus } from '@prisma/client';

export class SectionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() institutionId: string;

  @ApiProperty() academicYearId: string;
  @ApiProperty() subjectId: string;
  @ApiProperty() primaryTeacherId: string;

  @ApiProperty() gradeLevel: string;
  @ApiProperty() groupLabel: string;

  @ApiProperty({ enum: SectionStatus })
  status: SectionStatus;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  // Demo-ready includes
  @ApiProperty({ required: false, nullable: true })
  subject?: { id: string; name: string };

  @ApiProperty({ required: false, nullable: true })
  academicYear?: { id: string; name: string };

  @ApiProperty({ required: false, nullable: true })
  primaryTeacher?: { id: string; email: string | null; role: string };
}

export class PaginatedSectionsResponseDto {
  @ApiProperty({ type: [SectionResponseDto] })
  data: SectionResponseDto[];

  @ApiProperty()
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
