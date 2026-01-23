import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({
    example: 'Matemática I',
    minLength: 3,
    maxLength: 120,
  })
  @IsString()
  @Length(3, 120)
  name!: string;
}
