import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        institutionId: true,
        role: true,
        email: true,
        username: true,
        phoneE164: true,
        isActive: true,
        createdAt: true,
        teacherProfile: { select: { fullName: true } },
        studentProfile: { select: { fullName: true } },
      },
    });

    // “fullName” unificado para devolver algo bonito
    return users.map((u) => ({
      ...u,
      fullName: u.teacherProfile?.fullName ?? u.studentProfile?.fullName ?? null,
      teacherProfile: undefined,
      studentProfile: undefined,
    }));
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        institutionId: dto.institutionId,
        role: dto.role,
        email: dto.email ?? null,
        username: dto.username ?? null,
        phoneE164: dto.phoneE164 ?? null,
        passwordHash,
        isActive: true,

        ...(dto.role === 'TEACHER'
          ? { teacherProfile: { create: { fullName: dto.fullName ?? 'Docente' } } }
          : {}),

        ...(dto.role === 'STUDENT'
          ? { studentProfile: { create: { fullName: dto.fullName ?? 'Estudiante' } } }
          : {}),
      },
      select: {
        id: true,
        institutionId: true,
        role: true,
        email: true,
        username: true,
        phoneE164: true,
        isActive: true,
        createdAt: true,
        teacherProfile: { select: { fullName: true } },
        studentProfile: { select: { fullName: true } },
      },
    });

    return {
      ...user,
      fullName: user.teacherProfile?.fullName ?? user.studentProfile?.fullName ?? null,
      teacherProfile: undefined,
      studentProfile: undefined,
    };
  }
}
