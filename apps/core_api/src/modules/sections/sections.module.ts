import { Module } from '@nestjs/common';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [SectionsController],
  providers: [SectionsService, PrismaService],
  exports: [SectionsService],
})
export class SectionsModule {}
