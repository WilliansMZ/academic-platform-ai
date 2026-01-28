import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class UpdateSessionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Set null to detach from period',
    example: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null) // ✅ permite null sin validar UUID
  @IsUUID('4')
  periodId?: string | null;

  @ApiPropertyOptional({ example: '2026-03-12' })
  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @ApiPropertyOptional({ example: 'Semana 2', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(50)
  weekLabel?: string | null;

  @ApiPropertyOptional({ example: 'Nuevo título' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topicTitle?: string;

  @ApiPropertyOptional({ example: 'Nueva descripción', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  topicDescription?: string | null;
}
