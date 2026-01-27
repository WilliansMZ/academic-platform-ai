import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './common/auth/auth.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { SectionsModule } from './modules/sections/sections.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { MyModule } from './modules/my/my.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    InstitutionsModule,
    SubjectsModule,
    SectionsModule,
    EnrollmentsModule,
    MyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
