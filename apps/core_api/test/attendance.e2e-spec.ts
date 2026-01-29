import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAndGetToken } from './helpers/auth';

import {
  EnrollmentStatus,
  Role,
  SectionStatus,
  TeacherSectionRole,
  AttendanceStatus,
} from '@prisma/client';

import { hashValue } from '../src/common/auth/utils/crypto.util';

describe('Attendance (E2E) - HU-05.3', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_A = { identifier: 'admin@demo.edu', password: 'Admin12345!' };
  const ADMIN_B = { identifier: 'admin-b@demo.edu', password: 'Admin12345!' };
  const TEACHER_A = { identifier: 'teacher@demo.edu', password: 'Admin12345!' };
  const STUDENT_A = { identifier: 'student@demo.edu', password: 'Admin12345!' };

  const ATT_BASE = '/api/v1/attendance';

  // IDs seed (tenant A & B)
  let institutionAId: string;
  let institutionBId: string;

  let academicYearAId: string;
  let subjectAId: string;
  let periodAId: string;

  let teacherAId: string;
  let studentAId: string;
  let adminBId: string;

  // E2E controlled (tenant A)
  let sectionE2EId: string;
  let sessionE2EId: string;

  // Extra users for tests (tenant A)
  let teacherBId: string; // teacher not linked to sectionE2E (tenant-safe 404)
  let studentNotEnrolledId: string; // for 422 in bulk
  let studentBEnrolledId: string; // second student enrolled to verify student-only filtering

  // Cross-tenant session (tenant B) for 404
  let sessionTenantBId: string;

  // Track created data in tenant B for cleanup
  let createdTenantB:
    | { ayBId: string; subjectBId: string; periodBId: string; sectionBId: string; sessionBId: string }
    | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    // replica main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    const runId = Date.now();

    // ---------- resolve seed IDs ----------
    const instA = await prisma.institution.findUnique({
      where: { slug: 'institucion-demo' },
      select: { id: true },
    });
    if (!instA) throw new Error('Seed missing: institution A (slug institucion-demo)');
    institutionAId = instA.id;

    const instB = await prisma.institution.findUnique({
      where: { slug: 'institucion-b' },
      select: { id: true },
    });
    if (!instB) throw new Error('Seed missing: institution B (slug institucion-b)');
    institutionBId = instB.id;

    const ayA = await prisma.academicYear.findFirst({
      where: { institutionId: institutionAId, name: '2026' },
      select: { id: true },
    });
    if (!ayA) throw new Error('Seed missing: AcademicYear 2026 (tenant A)');
    academicYearAId = ayA.id;

    const subjectA = await prisma.subject.findFirst({
      where: { institutionId: institutionAId, name: 'Comunicación' },
      select: { id: true },
    });
    if (!subjectA) throw new Error('Seed missing: Subject Comunicación (tenant A)');
    subjectAId = subjectA.id;

    const periodA = await prisma.period.findFirst({
      where: { institutionId: institutionAId, name: 'Periodo 1' },
      select: { id: true },
    });
    if (!periodA) throw new Error('Seed missing: Periodo 1 (tenant A)');
    periodAId = periodA.id;

    const teacherA = await prisma.user.findFirst({
      where: { institutionId: institutionAId, email: 'teacher@demo.edu' },
      select: { id: true },
    });
    if (!teacherA) throw new Error('Seed missing: teacher@demo.edu (tenant A)');
    teacherAId = teacherA.id;

    const studentA = await prisma.user.findFirst({
      where: { institutionId: institutionAId, email: 'student@demo.edu' },
      select: { id: true },
    });
    if (!studentA) throw new Error('Seed missing: student@demo.edu (tenant A)');
    studentAId = studentA.id;

    const adminB = await prisma.user.findFirst({
      where: { institutionId: institutionBId, email: 'admin-b@demo.edu' },
      select: { id: true },
    });
    if (!adminB) throw new Error('Seed missing: admin-b@demo.edu (tenant B)');
    adminBId = adminB.id;

    // ---------- cleanup previous E2E data (tenant A) ----------
    // delete attendance for E2E sessions
    const e2eSessions = await prisma.session.findMany({
      where: { institutionId: institutionAId, topicTitle: { startsWith: 'E2E-ATT-' } },
      select: { id: true },
    });
    const e2eSessionIds = e2eSessions.map((s) => s.id);

    if (e2eSessionIds.length) {
      await prisma.attendance.deleteMany({ where: { sessionId: { in: e2eSessionIds } } });
      await prisma.session.deleteMany({ where: { id: { in: e2eSessionIds } } });
    }

    const e2eSections = await prisma.section.findMany({
      where: {
        institutionId: institutionAId,
        OR: [{ gradeLevel: { startsWith: 'E2E-ATT-' } }, { groupLabel: { startsWith: 'E2E-ATT-' } }],
      },
      select: { id: true },
    });
    const e2eSectionIds = e2eSections.map((s) => s.id);
    if (e2eSectionIds.length) {
      await prisma.enrollment.deleteMany({ where: { sectionId: { in: e2eSectionIds } } });
      await prisma.sectionTeacher.deleteMany({ where: { sectionId: { in: e2eSectionIds } } });
      await prisma.section.deleteMany({ where: { id: { in: e2eSectionIds } } });
    }

    // cleanup E2E users (tenant A)
    await prisma.user.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [{ email: { startsWith: 'e2e-att-' } }, { username: { startsWith: 'e2e-att-' } }],
      },
    });

    // ---------- create E2E section (tenant A) ----------
    const section = await prisma.section.create({
      data: {
        institutionId: institutionAId,
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: `E2E-ATT-5-${runId}`,
        groupLabel: `E2E-ATT-A-${runId}`,
        primaryTeacherId: teacherAId,
        status: SectionStatus.ACTIVE,
      },
      select: { id: true },
    });
    sectionE2EId = section.id;

    // link teacherA in section (policy)
    await prisma.sectionTeacher.upsert({
      where: { sectionId_teacherId: { sectionId: sectionE2EId, teacherId: teacherAId } },
      update: { role: TeacherSectionRole.PRIMARY },
      create: { sectionId: sectionE2EId, teacherId: teacherAId, role: TeacherSectionRole.PRIMARY },
    });

    // enroll studentA ACTIVE
    await prisma.enrollment.upsert({
      where: { sectionId_studentId: { sectionId: sectionE2EId, studentId: studentAId } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: {
        institutionId: institutionAId,
        sectionId: sectionE2EId,
        studentId: studentAId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    // ---------- create extra users for tests ----------
    const pwdHash = await hashValue('Admin12345!');

    // teacherB (not linked to sectionE2E) -> used to test tenant-safe 404 "teacher not in section"
    const teacherB = await prisma.user.create({
      data: {
        institutionId: institutionAId,
        role: Role.TEACHER,
        email: `e2e-att-teacherb-${runId}@demo.edu`,
        username: `e2e-att-teacherb-${runId}`,
        passwordHash: pwdHash,
        isActive: true,
        teacherProfile: { create: { fullName: 'E2E Teacher B' } },
      },
      select: { id: true },
    });
    teacherBId = teacherB.id;

    // studentNotEnrolled (NOT enrolled in sectionE2E) -> 422 test
    const studentNotEnrolled = await prisma.user.create({
      data: {
        institutionId: institutionAId,
        role: Role.STUDENT,
        email: `e2e-att-studentx-${runId}@demo.edu`,
        username: `e2e-att-studentx-${runId}`,
        passwordHash: pwdHash,
        isActive: true,
        studentProfile: { create: { fullName: 'E2E Student X' } },
      },
      select: { id: true },
    });
    studentNotEnrolledId = studentNotEnrolled.id;

    // studentBEnrolled (second student enrolled) -> verify student-only filtering
    const studentB = await prisma.user.create({
      data: {
        institutionId: institutionAId,
        role: Role.STUDENT,
        email: `e2e-att-studentb-${runId}@demo.edu`,
        username: `e2e-att-studentb-${runId}`,
        passwordHash: pwdHash,
        isActive: true,
        studentProfile: { create: { fullName: 'E2E Student B' } },
      },
      select: { id: true },
    });
    studentBEnrolledId = studentB.id;

    await prisma.enrollment.create({
      data: {
        institutionId: institutionAId,
        sectionId: sectionE2EId,
        studentId: studentBEnrolledId,
        status: EnrollmentStatus.ACTIVE,
      },
      select: { id: true },
    });

    // ---------- create E2E session (tenant A) ----------
    const session = await prisma.session.create({
      data: {
        institutionId: institutionAId,
        sectionId: sectionE2EId,
        periodId: periodAId,
        sessionDate: new Date('2026-03-10'),
        weekLabel: 'Semana E2E',
        topicTitle: `E2E-ATT-${runId}`,
        topicDescription: 'E2E Attendance bulk',
        createdBy: teacherAId,
      },
      select: { id: true },
    });
    sessionE2EId = session.id;

    // ---------- cross-tenant session (tenant B) for 404 ----------
    // NOTE: Seed may not create AY/period/sections/sessions in B. We create minimal data in B with runId to avoid unique conflicts.
    const ayB = await prisma.academicYear.create({
      data: {
        institutionId: institutionBId,
        name: `E2E-ATT-B-${runId}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        isCurrent: false,
      },
      select: { id: true },
    });

    const subjectB = await prisma.subject.create({
      data: {
        institutionId: institutionBId,
        name: `E2E-ATT-SUBJECT-B-${runId}`,
      },
      select: { id: true },
    });

    const periodB = await prisma.period.create({
      data: {
        institutionId: institutionBId,
        academicYearId: ayB.id,
        name: `E2E-ATT-P1-B-${runId}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
      },
      select: { id: true },
    });

    const sectionB = await prisma.section.create({
      data: {
        institutionId: institutionBId,
        academicYearId: ayB.id,
        subjectId: subjectB.id,
        gradeLevel: `E2E-ATT-B-${runId}`,
        groupLabel: `E2E-ATT-B-${runId}`,
        primaryTeacherId: adminBId,
        status: SectionStatus.ACTIVE,
      },
      select: { id: true },
    });

    const sessionB = await prisma.session.create({
      data: {
        institutionId: institutionBId,
        sectionId: sectionB.id,
        periodId: periodB.id,
        sessionDate: new Date('2026-03-10'),
        weekLabel: 'Semana E2E B',
        topicTitle: `E2E-ATT-TENANTB-${runId}`,
        topicDescription: 'Cross tenant session for 404',
        createdBy: adminBId,
      },
      select: { id: true },
    });

    sessionTenantBId = sessionB.id;
    createdTenantB = {
      ayBId: ayB.id,
      subjectBId: subjectB.id,
      periodBId: periodB.id,
      sectionBId: sectionB.id,
      sessionBId: sessionB.id,
    };
  });

  afterAll(async () => {
    // cleanup attendance + sessions (tenant A)
    if (sessionE2EId) {
      await prisma.attendance.deleteMany({ where: { sessionId: sessionE2EId } });
      await prisma.session.deleteMany({
        where: { id: sessionE2EId, institutionId: institutionAId },
      });
    }

    // cleanup section + enrollments (tenant A)
    if (sectionE2EId) {
      await prisma.enrollment.deleteMany({ where: { sectionId: sectionE2EId } });
      await prisma.sectionTeacher.deleteMany({ where: { sectionId: sectionE2EId } });
      await prisma.section.deleteMany({ where: { id: sectionE2EId } });
    }

    // cleanup extra users (tenant A)
    await prisma.user.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [{ email: { startsWith: 'e2e-att-' } }, { username: { startsWith: 'e2e-att-' } }],
      },
    });

    // cleanup cross-tenant data created in B
    if (createdTenantB) {
      await prisma.attendance.deleteMany({ where: { sessionId: createdTenantB.sessionBId } });
      await prisma.session.deleteMany({ where: { id: createdTenantB.sessionBId } });

      await prisma.sectionTeacher.deleteMany({ where: { sectionId: createdTenantB.sectionBId } });
      await prisma.enrollment.deleteMany({ where: { sectionId: createdTenantB.sectionBId } });
      await prisma.section.deleteMany({ where: { id: createdTenantB.sectionBId } });

      await prisma.period.deleteMany({ where: { id: createdTenantB.periodBId } });
      await prisma.subject.deleteMany({ where: { id: createdTenantB.subjectBId } });
      await prisma.academicYear.deleteMany({ where: { id: createdTenantB.ayBId } });
    }

    await app.close();
  });

  it('POST /attendance/bulk -> 401 no token', async () => {
    await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .send({ sessionId: sessionE2EId, items: [] })
      .expect(401);
  });

  it('POST /attendance/bulk -> 403 for admin', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: sessionE2EId,
        items: [{ studentId: studentAId, status: AttendanceStatus.PRESENT, note: 'x' }],
      })
      .expect(403);
  });

  it('POST /attendance/bulk -> 403 for student', async () => {
    const token = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: sessionE2EId,
        items: [{ studentId: studentAId, status: AttendanceStatus.PRESENT }],
      })
      .expect(403);
  });

  it('POST /attendance/bulk -> 404 tenant-safe when teacher not in section', async () => {
    const teacherBEmail = await prisma.user.findUnique({
      where: { id: teacherBId },
      select: { email: true },
    });
    if (!teacherBEmail?.email) throw new Error('Missing teacherB email');

    const token = await loginAndGetToken(app, teacherBEmail.email, 'Admin12345!');

    await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: sessionE2EId,
        items: [{ studentId: studentAId, status: AttendanceStatus.PRESENT }],
      })
      .expect(404);
  });

  it('POST /attendance/bulk -> 422 student not enrolled', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: sessionE2EId,
        items: [{ studentId: studentNotEnrolledId, status: AttendanceStatus.PRESENT }],
      })
      .expect(422);
  });

  it('POST /attendance/bulk -> 200/201 created (teacher)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const res = await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: sessionE2EId,
        items: [
          { studentId: studentAId, status: AttendanceStatus.PRESENT, note: 'Asistió' },
          { studentId: studentBEnrolledId, status: AttendanceStatus.ABSENT, note: 'Faltó' },
        ],
      })
      .expect((r) => {
        if (![200, 201].includes(r.status)) {
          throw new Error(`Expected 200 or 201, got ${r.status}`);
        }
      });

    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('created');
    expect(res.body.data).toHaveProperty('updated');
  });

  it('POST /attendance/bulk -> 200/201 updated (teacher)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const res = await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: sessionE2EId,
        items: [{ studentId: studentAId, status: AttendanceStatus.LATE, note: 'Llegó tarde' }],
      })
      .expect((r) => {
        if (![200, 201].includes(r.status)) {
          throw new Error(`Expected 200 or 201, got ${r.status}`);
        }
      });

    expect(res.body.data.updated).toBeGreaterThanOrEqual(1);
  });

  it('GET /attendance -> 200 teacher sees full list', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const res = await request(app.getHttpServer())
      .get(`${ATT_BASE}?sessionId=${sessionE2EId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /attendance -> 200 student sees only own row', async () => {
    const token = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    const res = await request(app.getHttpServer())
      .get(`${ATT_BASE}?sessionId=${sessionE2EId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const row of res.body.data) {
      expect(row.studentId).toBe(studentAId);
    }
  });

  it('GET /attendance -> 404 cross-tenant sessionId', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .get(`${ATT_BASE}?sessionId=${sessionTenantBId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /attendance -> 400 validation (bad uuid)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .get(`${ATT_BASE}?sessionId=not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('POST /attendance/bulk -> 404 session not found (random uuid)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .post(`${ATT_BASE}/bulk`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId: randomUUID(),
        items: [{ studentId: studentAId, status: AttendanceStatus.PRESENT }],
      })
      .expect(404);
  });
});
