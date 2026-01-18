import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'UUID-de-institucion' })
  institutionId: string;

  @ApiProperty({ enum: Role, example: Role.STUDENT })
  role: Role;

  @ApiProperty({ example: 'juan@email.com', required: false })
  email?: string;

  @ApiProperty({ example: 'juanperez', required: false })
  username?: string;

  @ApiProperty({ example: '+51999999999', required: false })
  phoneE164?: string;

  @ApiProperty({ example: 'Admin12345!' })
  password: string;

  @ApiProperty({ example: 'Juan Perez', required: false })
  fullName?: string;
}
