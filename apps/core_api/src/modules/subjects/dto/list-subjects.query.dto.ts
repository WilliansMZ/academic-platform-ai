import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSubjectsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;

  @ApiPropertyOptional({ example: 'mate' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt', enum: ['createdAt', 'name'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'name'])
  sortBy?: 'createdAt' | 'name' = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
