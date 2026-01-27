import { Module } from '@nestjs/common';
import { MyController } from './my.controller';
import { MyService } from './my.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [MyController],
  providers: [MyService, PrismaService],
})
export class MyModule {}
