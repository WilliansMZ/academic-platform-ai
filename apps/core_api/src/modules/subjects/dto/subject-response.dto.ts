import { ApiProperty } from '@nestjs/swagger';

export class SubjectResponseDto {
  @ApiProperty({ example: 'b7a2d6d6-9f77-4f21-8c28-0c1f9a3d2e11' })
  id!: string;

  @ApiProperty({ example: 'Matemática I' })
  name!: string;

  @ApiProperty({ example: '2026-01-22T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-01-22T10:05:00.000Z' })
  updatedAt!: string;
}
