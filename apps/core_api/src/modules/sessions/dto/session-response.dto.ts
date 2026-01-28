import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sectionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  periodId!: string | null;

  @ApiProperty({ example: '2026-03-11' })
  sessionDate!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Semana 1' })
  weekLabel!: string | null;

  @ApiProperty({ example: 'Verbo to be (introducción)' })
  topicTitle!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Identificar uso de am/is/are.' })
  topicDescription!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty({ example: '2026-01-27T23:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-01-27T23:05:00.000Z' })
  updatedAt!: string;
}
