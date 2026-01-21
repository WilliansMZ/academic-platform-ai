import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Institución Demo', minLength: 3, maxLength: 120 })
  @IsString()
  @Length(3, 120)
  name!: string;

  @ApiProperty({ example: 'institucion-demo', minLength: 3, maxLength: 60 })
  @IsString()
  @Length(3, 60)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must match ^[a-z0-9-]+$' })
  slug!: string;
}
