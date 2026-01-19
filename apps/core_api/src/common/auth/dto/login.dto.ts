import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@demo.edu', description: 'Email o username' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'Admin12345!' })
  @IsString()
  @MinLength(8)
  password: string;
}
