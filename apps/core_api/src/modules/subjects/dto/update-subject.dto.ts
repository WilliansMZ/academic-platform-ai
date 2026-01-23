import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateSubjectDto {
  @ApiPropertyOptional({
    example: 'Matemática I (Actualizado)',
    minLength: 3,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  name?: string;
}
