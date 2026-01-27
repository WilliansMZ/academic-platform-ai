import { ApiProperty } from '@nestjs/swagger';
import { MyCourseItemDto } from './my-course-item.dto';

export class MyCoursesResponseDto {
  @ApiProperty({ type: [MyCourseItemDto] })
  data!: MyCourseItemDto[];
}
