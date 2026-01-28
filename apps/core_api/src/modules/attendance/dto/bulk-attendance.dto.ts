import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class BulkAttendanceItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkAttendanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  sessionId!: string;

  @ApiProperty({ type: [BulkAttendanceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceItemDto)
  items!: BulkAttendanceItemDto[];
}
