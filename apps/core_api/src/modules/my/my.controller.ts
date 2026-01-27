import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { MyService } from './my.service';
import { MyCoursesResponseDto } from './dto/my-courses-response.dto';

@ApiTags('My')
@ApiBearerAuth('access-token')
@Controller('my')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MyController {
  constructor(private readonly myService: MyService) {}

  @Get('courses')
  @Roles(Role.TEACHER, Role.STUDENT)
  @ApiOkResponse({ type: MyCoursesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid token' })
  @ApiForbiddenResponse({ description: 'Role not allowed or missing institution context' })
  async myCourses(@CurrentUser() user: any): Promise<MyCoursesResponseDto> {
    return this.myService.getMyCourses(user);
  }
}
