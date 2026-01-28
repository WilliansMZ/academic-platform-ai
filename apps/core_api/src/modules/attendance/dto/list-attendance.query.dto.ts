import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ListAttendanceQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  sessionId!: string;
}
