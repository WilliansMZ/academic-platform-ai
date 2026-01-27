import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, SectionStatus } from '@prisma/client';
import { MyCourseItemDto } from './dto/my-course-item.dto';

type CurrentUserPayload = {
  sub?: string;
  id?: string;
  institutionId?: string | null;
  role?: Role;
};

@Injectable()
export class MyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyCourses(user: CurrentUserPayload): Promise<{ data: MyCourseItemDto[] }> {
    const userId = user?.sub ?? user?.id;
    const institutionId = user?.institutionId ?? undefined;
    const role = user?.role;

    if (!userId) throw new ForbiddenException('Missing user id');
    if (!institutionId) throw new ForbiddenException('Missing institution context');

    // Este endpoint es "my academic courses": solo TEACHER y STUDENT
    if (role !== Role.TEACHER && role !== Role.STUDENT) {
      throw new ForbiddenException('Insufficient role');
    }

    const includeArchived = false; // decisión del sprint: solo ACTIVE (más limpio)

    if (role === Role.TEACHER) {
      const statusFilter = includeArchived ? undefined : SectionStatus.ACTIVE;

      // A) Secciones donde es primaryTeacher
      const primarySections = await this.prisma.section.findMany({
        where: {
          institutionId,
          primaryTeacherId: userId,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        include: {
          subject: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      });

      // B) Secciones donde figura en SectionTeacher (assistant u otros roles)
      const assistantLinks = await this.prisma.sectionTeacher.findMany({
        where: {
          teacherId: userId,
          section: {
            institutionId,
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        },
        include: {
          section: {
            include: {
              subject: { select: { id: true, name: true } },
              academicYear: { select: { id: true, name: true } },
            },
          },
        },
      });

      const assistantSections = assistantLinks.map((l) => l.section);

      // merge + dedupe por section.id
      const merged = [...primarySections, ...assistantSections];
      const byId = new Map(merged.map((s) => [s.id, s]));
      const unique = [...byId.values()];

      const data = unique
        .map<MyCourseItemDto>((s) => ({
          section: {
            id: s.id,
            gradeLevel: s.gradeLevel,
            groupLabel: s.groupLabel,
            status: s.status,
          },
          subject: { id: s.subject.id, name: s.subject.name },
          academicYear: { id: s.academicYear.id, name: s.academicYear.name },
          myRole: 'TEACHER',
        }))
        .sort((a, b) => {
          // Orden estable para demo
          const ay = b.academicYear.name.localeCompare(a.academicYear.name);
          if (ay !== 0) return ay;
          const sj = a.subject.name.localeCompare(b.subject.name);
          if (sj !== 0) return sj;
          const gl = a.section.gradeLevel.localeCompare(b.section.gradeLevel);
          if (gl !== 0) return gl;
          return a.section.groupLabel.localeCompare(b.section.groupLabel);
        });

      return { data };
    }

    // role === STUDENT
    {
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          institutionId,
          studentId: userId,
          status: 'ACTIVE',
          section: includeArchived ? undefined : { status: SectionStatus.ACTIVE },
        },
        include: {
          section: {
            include: {
              subject: { select: { id: true, name: true } },
              academicYear: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Si hay múltiples enrollments a la misma section por históricos (raro), dedupe igual.
      const bySectionId = new Map(enrollments.map((e) => [e.section.id, e.section]));
      const uniqueSections = [...bySectionId.values()];

      const data = uniqueSections
        .map<MyCourseItemDto>((s) => ({
          section: {
            id: s.id,
            gradeLevel: s.gradeLevel,
            groupLabel: s.groupLabel,
            status: s.status,
          },
          subject: { id: s.subject.id, name: s.subject.name },
          academicYear: { id: s.academicYear.id, name: s.academicYear.name },
          myRole: 'STUDENT',
        }))
        .sort((a, b) => {
          const ay = b.academicYear.name.localeCompare(a.academicYear.name);
          if (ay !== 0) return ay;
          const sj = a.subject.name.localeCompare(b.subject.name);
          if (sj !== 0) return sj;
          const gl = a.section.gradeLevel.localeCompare(b.section.gradeLevel);
          if (gl !== 0) return gl;
          return a.section.groupLabel.localeCompare(b.section.groupLabel);
        });

      return { data };
    }
  }
}
