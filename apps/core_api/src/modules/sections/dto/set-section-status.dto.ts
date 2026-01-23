import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SectionStatus } from '@prisma/client';

export class SetSectionStatusDto {
  @ApiProperty({ enum: SectionStatus })
  @IsEnum(SectionStatus)
  status: SectionStatus;
}
