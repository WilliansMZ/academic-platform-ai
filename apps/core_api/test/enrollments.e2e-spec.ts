import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loginAndGetToken } from './helpers/auth';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role, SectionStatus } from '@prisma/client';

describe('Enrollments (E2E) - HU-04.3', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_A = { identifier: 'admin@demo.edu', password: 'Admin12345!' };
  const ADMIN_B = { identifier: 'admin-b@demo.edu', password: 'Admin12345!' };
  const TEACHER_A = { identifier: 'teacher@demo.edu', password: 'Admin12345!' };

  const ENROLLMENTS_BASE = '/api/v1/enrollments';
  const SECTIONS_BASE = '/api/v1/sections';

  // IDs resueltos desde seed (sin hardcode)
  let institutionAId: string;
  let teacherAId: string;
  let studentAId: string;
  let subjectAId: string;
  let academicYearAId: string;

  // Entidades E2E
  let sectionActiveId: string;
  let sectionArchivedId: string;
  let student2Id: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // ✅ replica main.ts (igual que sections)
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

    const teacher = await prisma.user.findFirst({
      where: { institutionId: institutionAId, email: 'teacher@demo.edu', role: Role.TEACHER },
      select: { id: true },
    });
    if (!teacher) throw new Error('Seed missing: teacher@demo.edu (tenant A)');
    teacherAId = teacher.id;

    const student = await prisma.user.findFirst({
      where: { institutionId: institutionAId, email: 'student@demo.edu', role: Role.STUDENT },
      select: { id: true },
    });
    if (!student) throw new Error('Seed missing: student@demo.edu (tenant A)');
    studentAId = student.id;

    // ========= Cleanup SOLO data E2E =========
    // Limpia enrollments y sections E2E (orden importante: primero enrollments)
    await prisma.enrollment.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [{ section: { groupLabel: { startsWith: 'E2E-' } } }],
      },
    });

    await prisma.section.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [{ groupLabel: { startsWith: 'E2E-' } }, { gradeLevel: { startsWith: 'E2E-' } }],
      },
    });

    // Limpia student2 si existe
    await prisma.user.deleteMany({
      where: {
        institutionId: institutionAId,
        email: 'e2e-student2@demo.edu',
      },
    });

    // ========= Crear student2 (DB direct, idempotente) =========
    const student2 = await prisma.user.create({
      data: {
        institutionId: institutionAId,
        role: Role.STUDENT,
        email: 'e2e-student2@demo.edu',
        username: 'e2e-student2',
        passwordHash: 'x', // no se usa login en tests
        isActive: true,
        studentProfile: { create: { fullName: 'E2E Student 2' } },
      },
      select: { id: true },
    });
    student2Id = student2.id;

    // ========= Crear Section ACTIVE (vía API para cubrir HU-04.2 + dependencia) =========
    const tokenA = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const createdActive = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-ENR',
        groupLabel: 'E2E-ENR-ACTIVE',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    sectionActiveId = createdActive.body.id;

    // ========= Crear Section ARCHIVED (vía API + status action) =========
    const createdArchived = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-ENR',
        groupLabel: 'E2E-ENR-ARCHIVED',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    sectionArchivedId = createdArchived.body.id;

    await request(app.getHttpServer())
      .patch(`${SECTIONS_BASE}/${sectionArchivedId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);
  });

  afterAll(async () => {
    // Cleanup final (recomendado)
    await prisma.enrollment.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [{ section: { groupLabel: { startsWith: 'E2E-' } } }],
      },
    });

    await prisma.section.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [{ groupLabel: { startsWith: 'E2E-' } }, { gradeLevel: { startsWith: 'E2E-' } }],
      },
    });

    await prisma.user.deleteMany({
      where: { institutionId: institutionAId, email: 'e2e-student2@demo.edu' },
    });

    await app.close();
  });

  // ==========================================================
  // A) Auth / RBAC
  // ==========================================================

  it('GET /enrollments -> 401 no token', async () => {
    await request(app.getHttpServer()).get(`${ENROLLMENTS_BASE}?page=1&pageSize=10`).expect(401);
  });

  it('GET /enrollments -> 403 for teacher', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .get(`${ENROLLMENTS_BASE}?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  // ==========================================================
  // B) List + filters (Admin)
  // ==========================================================

  it('GET /enrollments -> 200 + meta (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .get(`${ENROLLMENTS_BASE}?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(10);
  });

  // ==========================================================
  // C) Create Enrollment (Admin)
  // ==========================================================

  it('POST /enrollments -> 201 create (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .post(ENROLLMENTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionActiveId,
        studentId: student2Id,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.sectionId ?? res.body.section?.id).toBe(sectionActiveId);
    expect(res.body.studentId ?? res.body.student?.id).toBe(student2Id);
  });

  it('POST /enrollments -> 409 duplicate (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .post(ENROLLMENTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionActiveId,
        studentId: student2Id,
      })
      .expect(409);
  });

  it('POST /enrollments -> 422 student role != STUDENT (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .post(ENROLLMENTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionActiveId,
        studentId: teacherAId, // TEACHER
      })
      .expect(422);
  });

  it('POST /enrollments -> 422 section ARCHIVED (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .post(ENROLLMENTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionArchivedId,
        studentId: student2Id,
      })
      .expect(422);
  });

  // ==========================================================
  // D) Filters (Admin)
  // ==========================================================

  it('GET /enrollments?sectionId=... -> 200 filtered', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .get(`${ENROLLMENTS_BASE}?sectionId=${sectionActiveId}&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    for (const item of res.body.data) {
      expect(item.section?.id ?? item.sectionId).toBe(sectionActiveId);
    }
  });

  it('GET /enrollments?studentId=... -> 200 filtered', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .get(`${ENROLLMENTS_BASE}?studentId=${student2Id}&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    for (const item of res.body.data) {
      expect(item.student?.id ?? item.studentId).toBe(student2Id);
    }
  });

  it('GET /enrollments?status=ACTIVE -> 200 filtered', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .get(`${ENROLLMENTS_BASE}?status=ACTIVE&page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    for (const item of res.body.data) {
      expect(item.status).toBe('ACTIVE');
    }
  });

  // ==========================================================
  // E) Status action (Admin) + cross-tenant
  // ==========================================================

  it('PATCH /enrollments/:id/status -> 404 cross-tenant (adminB)', async () => {
    const tokenA = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);
    const tokenB = await loginAndGetToken(app, ADMIN_B.identifier, ADMIN_B.password);

    const created = await request(app.getHttpServer())
      .post(ENROLLMENTS_BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sectionId: sectionActiveId,
        studentId: studentAId, // student seed A (diferente a student2)
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`${ENROLLMENTS_BASE}/${created.body.id}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'DROPPED' })
      .expect(404);
  });

  it('PATCH /enrollments/:id/status -> 200 drop + activate (adminA)', async () => {
  const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

  // 1) Asegurar que existe un enrollment para (sectionActiveId, student2Id)
  //    Si ya existe -> lo usamos. Si no -> lo creamos.
  let enrollmentId: string | null = null;

  const existing = await prisma.enrollment.findUnique({
    where: { sectionId_studentId: { sectionId: sectionActiveId, studentId: student2Id } },
    select: { id: true },
  });

  if (existing) {
    enrollmentId = existing.id;
  } else {
    const created = await request(app.getHttpServer())
      .post(ENROLLMENTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: sectionActiveId,
        studentId: student2Id,
      })
      .expect(201);

    enrollmentId = created.body.id;
  }

  // 2) DROPPED
  const dropped = await request(app.getHttpServer())
    .patch(`${ENROLLMENTS_BASE}/${enrollmentId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'DROPPED' })
    .expect(200);

  expect(dropped.body.status).toBe('DROPPED');

  // 3) ACTIVE
  const activated = await request(app.getHttpServer())
    .patch(`${ENROLLMENTS_BASE}/${enrollmentId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'ACTIVE' })
    .expect(200);

  expect(activated.body.status).toBe('ACTIVE');
});

});
