import { ApiProperty } from '@nestjs/swagger';
import { InstitutionStatus } from '@prisma/client';

export class InstitutionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: InstitutionStatus }) status!: InstitutionStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
