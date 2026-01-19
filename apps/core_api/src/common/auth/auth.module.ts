import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { PrismaModule } from '../../prisma/prisma.module'; // ajusta

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}), // secrets en runtime desde env
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy],
  exports: [AuthService],
})
export class AuthModule {}
