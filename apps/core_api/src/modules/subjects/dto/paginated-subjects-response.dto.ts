import { ApiProperty } from '@nestjs/swagger';
import { SubjectResponseDto } from './subject-response.dto';

class PaginationMetaDto {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) pageSize!: number;
  @ApiProperty({ example: 57 }) total!: number;
  @ApiProperty({ example: 3 }) totalPages!: number;
}

export class PaginatedSubjectsResponseDto {
  @ApiProperty({ type: [SubjectResponseDto] })
  data!: SubjectResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
