import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export class SessionAccessPolicy {
  constructor(private readonly prisma: PrismaService) {}

  assertHasInstitution(institutionId?: string | null) {
    if (!institutionId) throw new ForbiddenException('Missing institutionId');
  }

  async assertTeacherInSection(args: {
    institutionId: string;
    teacherId: string;
    sectionId: string;
  }) {
    const section = await this.prisma.section.findFirst({
      where: { id: args.sectionId, institutionId: args.institutionId },
      select: {
        id: true,
        status: true,
        primaryTeacherId: true,
        teachers: { select: { teacherId: true } },
      },
    });

    if (!section) throw new NotFoundException('Section not found');
    if (section.status !== 'ACTIVE') throw new UnprocessableEntityException('Section is not ACTIVE');

    const isTeacher =
      section.primaryTeacherId === args.teacherId ||
      section.teachers.some((t) => t.teacherId === args.teacherId);

    if (!isTeacher) throw new NotFoundException(); // 👈 cross-tenant style (no leak)
  }

  async assertTeacherCanManageSession(args: {
    institutionId: string;
    teacherId: string;
    sessionId: string;
  }) {
    const session = await this.prisma.session.findFirst({
      where: { id: args.sessionId, institutionId: args.institutionId },
      select: {
        id: true,
        section: {
          select: {
            primaryTeacherId: true,
            teachers: { select: { teacherId: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException();

    const can =
      session.section.primaryTeacherId === args.teacherId ||
      session.section.teachers.some((t) => t.teacherId === args.teacherId);

    if (!can) throw new NotFoundException();
  }

  async assertStudentCanViewSession(args: {
    institutionId: string;
    studentId: string;
    sessionId: string;
  }) {
    const session = await this.prisma.session.findFirst({
      where: { id: args.sessionId, institutionId: args.institutionId },
      select: { id: true, sectionId: true },
    });

    if (!session) throw new NotFoundException();

    const enr = await this.prisma.enrollment.findFirst({
      where: {
        institutionId: args.institutionId,
        sectionId: session.sectionId,
        studentId: args.studentId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!enr) throw new NotFoundException();
  }
}
