import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID('4')
  sectionId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
    description: 'Optional academic period',
  })
  @IsOptional()
  @IsUUID('4')
  periodId?: string;

  @ApiProperty({
    example: '2026-03-11',
    description: 'ISO date string (yyyy-mm-dd)',
  })
  @IsDateString()
  sessionDate!: string;

  @ApiPropertyOptional({ example: 'Semana 1' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  weekLabel?: string;

  @ApiProperty({ example: 'Verbo to be (introducción)' })
  @IsString()
  @MaxLength(200)
  topicTitle!: string;

  @ApiPropertyOptional({ example: 'Identificar uso de am/is/are.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  topicDescription?: string;
}
