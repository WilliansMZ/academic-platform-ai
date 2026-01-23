import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateSectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  academicYearId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId: string;

  @ApiProperty({ example: '1', description: 'Nivel/grado (string por tu schema)' })
  @IsString()
  @Length(1, 50)
  gradeLevel: string;

  @ApiProperty({ example: 'A', description: 'Etiqueta de grupo/sección' })
  @IsString()
  @Length(1, 50)
  groupLabel: string;

  @ApiProperty({ format: 'uuid', description: 'UserId del docente principal (role=TEACHER)' })
  @IsUUID()
  primaryTeacherId: string;
}
