import { ApiProperty } from '@nestjs/swagger';
import { SessionResponseDto } from './session-response.dto';

class PaginationMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class SessionsPageDto {
  @ApiProperty({ type: [SessionResponseDto] })
  data!: SessionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
