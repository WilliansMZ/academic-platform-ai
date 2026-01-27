import { ApiProperty } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetEnrollmentStatusDto {
  @ApiProperty({ enum: EnrollmentStatus })
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus; // ACTIVE | DROPPED
}
