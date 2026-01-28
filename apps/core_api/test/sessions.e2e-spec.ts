import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loginAndGetToken } from './helpers/auth';
import { PrismaService } from '../src/prisma/prisma.service';
import { SectionStatus, TeacherSectionRole, EnrollmentStatus } from '@prisma/client';

describe('Sessions (E2E) - HU-05.1', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_A = { identifier: 'admin@demo.edu', password: 'Admin12345!' };
  const ADMIN_B = { identifier: 'admin-b@demo.edu', password: 'Admin12345!' };
  const TEACHER_A = { identifier: 'teacher@demo.edu', password: 'Admin12345!' };
  const STUDENT_A = { identifier: 'student@demo.edu', password: 'Admin12345!' };

  const SESSIONS_BASE = '/api/v1/sessions';

  // IDs resueltos desde seed (sin hardcode)
  let institutionAId: string;
  let institutionBId: string;
  let academicYearAId: string;
  let subjectAId: string;
  let periodAId: string;

  let teacherAId: string;
  let studentAId: string;

  // ✅ sección E2E controlada por el test
  let sectionE2EId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // ✅ replica main.ts
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

    // ========= Resolver IDs desde seed =========
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

    const ay = await prisma.academicYear.findFirst({
      where: { institutionId: institutionAId, name: '2026' },
      select: { id: true },
    });
    if (!ay) throw new Error('Seed missing: AcademicYear 2026 (tenant A)');
    academicYearAId = ay.id;

    const subject = await prisma.subject.findFirst({
      where: { institutionId: institutionAId, name: 'Comunicación' },
      select: { id: true },
    });
    if (!subject) throw new Error('Seed missing: Subject Comunicación (tenant A)');
    subjectAId = subject.id;

    const period = await prisma.period.findFirst({
      where: { institutionId: institutionAId, name: 'Periodo 1' },
      select: { id: true },
    });
    if (!period) throw new Error('Seed missing: Periodo 1 (tenant A)');
    periodAId = period.id;

    const teacher = await prisma.user.findFirst({
      where: { institutionId: institutionAId, email: 'teacher@demo.edu' },
      select: { id: true },
    });
    if (!teacher) throw new Error('Seed missing: teacher@demo.edu (tenant A)');
    teacherAId = teacher.id;

    const student = await prisma.user.findFirst({
      where: { institutionId: institutionAId, email: 'student@demo.edu' },
      select: { id: true },
    });
    if (!student) throw new Error('Seed missing: student@demo.edu (tenant A)');
    studentAId = student.id;

    // ========= Cleanup SOLO data E2E =========
    // 1) borrar sesiones E2E
    await prisma.session.deleteMany({
      where: { institutionId: institutionAId, topicTitle: { startsWith: 'E2E-' } },
    });

    // 2) borrar secciones E2E (y dependencias)
    const e2eSections = await prisma.section.findMany({
      where: {
        institutionId: institutionAId,
        OR: [{ gradeLevel: { startsWith: 'E2E-' } }, { groupLabel: { startsWith: 'E2E-' } }],
      },
      select: { id: true },
    });

    const e2eSectionIds = e2eSections.map((s) => s.id);

    if (e2eSectionIds.length) {
      await prisma.enrollment.deleteMany({ where: { sectionId: { in: e2eSectionIds } } });
      await prisma.sectionTeacher.deleteMany({ where: { sectionId: { in: e2eSectionIds } } });
      await prisma.section.deleteMany({ where: { id: { in: e2eSectionIds } } });
    }

    // ========= Crear Section E2E controlada =========
    const section = await prisma.section.create({
      data: {
        institutionId: institutionAId,
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-5',
        groupLabel: 'E2E-A',
        primaryTeacherId: teacherAId,
        status: SectionStatus.ACTIVE,
      },
      select: { id: true },
    });
    sectionE2EId = section.id;

    // teacher link (para policy OR primary/assistant)
    await prisma.sectionTeacher.upsert({
      where: { sectionId_teacherId: { sectionId: sectionE2EId, teacherId: teacherAId } },
      update: { role: TeacherSectionRole.PRIMARY },
      create: { sectionId: sectionE2EId, teacherId: teacherAId, role: TeacherSectionRole.PRIMARY },
    });

    // enrollment ACTIVE (para student queries)
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
  });

  afterAll(async () => {
    // Cleanup final
    await prisma.session.deleteMany({
      where: { institutionId: institutionAId, topicTitle: { startsWith: 'E2E-' } },
    });

    if (sectionE2EId) {
      await prisma.enrollment.deleteMany({ where: { sectionId: sectionE2EId } });
      await prisma.sectionTeacher.deleteMany({ where: { sectionId: sectionE2EId } });
      await prisma.section.deleteMany({ where: { id: sectionE2EId } });
    }

    await app.close();
  });

  it('GET /sessions -> 401 no token', async () => {
    await request(app.getHttpServer()).get(`${SESSIONS_BASE}?page=1&pageSize=10`).expect(401);
  });

  it('GET /sessions -> 403 for admin (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .get(`${SESSIONS_BASE}?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /sessions -> 200 + meta (teacherA)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const res = await request(app.getHttpServer())
      .get(`${SESSIONS_BASE}?page=1&pageSize=10&sectionId=${sectionE2EId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(10);
  });

  it('GET /sessions -> 200 (studentA, only enrolled sections)', async () => {
    const token = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    const res = await request(app.getHttpServer())
      .get(`${SESSIONS_BASE}?page=1&pageSize=10&sectionId=${sectionE2EId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });

  it('POST /sessions -> 403 for student', async () => {
    const token = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-03-11',
        topicTitle: 'E2E-ShouldFail',
      })
      .expect(403);
  });

  it('POST /sessions -> 201 create (teacherA)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const res = await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionE2EId,
        periodId: periodAId,
        sessionDate: '2026-03-11',
        weekLabel: 'E2E-W1',
        topicTitle: 'E2E-Session Create',
        topicDescription: 'E2E-Desc',
      })
      .expect(201);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.sectionId).toBe(sectionE2EId);
    expect(res.body.data.sessionDate).toBe('2026-03-11');
  });

  it('POST /sessions -> 404 invalid periodId (teacherA)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    // ✅ UUID v4 para pasar IsUUID('4') y llegar al service
    const fakePeriodV4 = '11111111-1111-4111-8111-111111111111';

    await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionE2EId,
        periodId: fakePeriodV4,
        sessionDate: '2026-03-12',
        topicTitle: 'E2E-Invalid Period',
      })
      .expect(404);
  });

  it('POST /sessions -> 400 invalid date (DTO validation)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-99-99', // falla IsDateString -> 400
        topicTitle: 'E2E-Invalid Date',
      })
      .expect(400);
  });

  it('GET /sessions/:id -> 200 for teacherA', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const created = await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-03-13',
        topicTitle: 'E2E-Session One',
      })
      .expect(201);

    const id = created.body.data.id as string;

    const res = await request(app.getHttpServer())
      .get(`${SESSIONS_BASE}/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.id).toBe(id);
  });

  it('GET /sessions/:id -> 200 for studentA (enrolled)', async () => {
    const teacherToken = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);
    const studentToken = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    const created = await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-03-14',
        topicTitle: 'E2E-Session Visible To Student',
      })
      .expect(201);

    const id = created.body.data.id as string;

    await request(app.getHttpServer())
      .get(`${SESSIONS_BASE}/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });

  it('PATCH /sessions/:id -> 403 for student', async () => {
    const teacherToken = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);
    const studentToken = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    const created = await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-03-15',
        topicTitle: 'E2E-Session Patch Forbidden',
      })
      .expect(201);

    const id = created.body.data.id as string;

    await request(app.getHttpServer())
      .patch(`${SESSIONS_BASE}/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ topicTitle: 'E2E-New' })
      .expect(403);
  });

  it('PATCH /sessions/:id -> 200 update (teacherA)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const created = await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-03-16',
        topicTitle: 'E2E-Session To Update',
      })
      .expect(201);

    const id = created.body.data.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`${SESSIONS_BASE}/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        topicTitle: 'E2E-Session Updated',
        weekLabel: 'E2E-W2',
      })
      .expect(200);

    expect(updated.body.data.id).toBe(id);
    expect(updated.body.data.topicTitle).toBe('E2E-Session Updated');
    expect(updated.body.data.weekLabel).toBe('E2E-W2');
  });

  it('GET /sessions/:id -> 403 for adminB (policy: admin cannot read sessions)', async () => {
    const teacherToken = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);
    const adminBToken = await loginAndGetToken(app, ADMIN_B.identifier, ADMIN_B.password);

    const created = await request(app.getHttpServer())
      .post(SESSIONS_BASE)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: sectionE2EId,
        sessionDate: '2026-03-17',
        topicTitle: 'E2E-AdminB Forbidden',
      })
      .expect(201);

    const id = created.body.data.id as string;

    await request(app.getHttpServer())
      .get(`${SESSIONS_BASE}/${id}`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(403);
  });
});
