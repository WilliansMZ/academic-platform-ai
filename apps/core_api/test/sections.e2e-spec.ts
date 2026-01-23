import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loginAndGetToken } from './helpers/auth';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sections (E2E) - HU-04.2', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_A = { identifier: 'admin@demo.edu', password: 'Admin12345!' };
  const ADMIN_B = { identifier: 'admin-b@demo.edu', password: 'Admin12345!' };
  const TEACHER_A = { identifier: 'teacher@demo.edu', password: 'Admin12345!' };

  const SECTIONS_BASE = '/api/v1/sections';

  // IDs resueltos desde seed (sin hardcode)
  let institutionAId: string;
  let academicYearAId: string;
  let subjectAId: string;
  let teacherAId: string;
  let studentAId: string;

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
    // Seed: "Institución Demo" -> slug: "institucion-demo"
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
    // Usamos prefijo en gradeLevel + groupLabel para aislar
    await prisma.section.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [
          { gradeLevel: { startsWith: 'E2E-' } },
          { groupLabel: { startsWith: 'E2E-' } },
        ],
      },
    });
  });

  afterAll(async () => {
    // Cleanup final (opcional, recomendado)
    await prisma.section.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [
          { gradeLevel: { startsWith: 'E2E-' } },
          { groupLabel: { startsWith: 'E2E-' } },
        ],
      },
    });

    await app.close();
  });

  it('GET /sections -> 401 no token', async () => {
    await request(app.getHttpServer()).get(`${SECTIONS_BASE}?page=1&pageSize=10`).expect(401);
  });

  it('GET /sections -> 403 for teacher', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .get(`${SECTIONS_BASE}?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /sections -> 200 + meta (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .get(`${SECTIONS_BASE}?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(10);
  });

  it('POST /sections -> 201 create (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-5',
        groupLabel: 'E2E-A',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.gradeLevel).toBe('E2E-5');
    expect(res.body.groupLabel).toBe('E2E-A');
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST /sections -> 409 duplicate (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-dup',
        groupLabel: 'E2E-dup',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-dup',
        groupLabel: 'E2E-dup',
        primaryTeacherId: teacherAId,
      })
      .expect(409);
  });

  it('PATCH /sections/:id -> 422 primaryTeacher role != TEACHER (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const created = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-422',
        groupLabel: 'E2E-422',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`${SECTIONS_BASE}/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ primaryTeacherId: studentAId }) // STUDENT -> 422
      .expect(422);
  });

  it('PATCH /sections/:id -> 400 forbidNonWhitelisted (status should not exist)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const created = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-400',
        groupLabel: 'E2E-400',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`${SECTIONS_BASE}/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ARCHIVED' })
      .expect(400);
  });

  it('PATCH /sections/:id/status -> 200 archive + activate', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const created = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-status',
        groupLabel: 'E2E-status',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    const archived = await request(app.getHttpServer())
      .patch(`${SECTIONS_BASE}/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);

    expect(archived.body.status).toBe('ARCHIVED');

    const activated = await request(app.getHttpServer())
      .patch(`${SECTIONS_BASE}/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    expect(activated.body.status).toBe('ACTIVE');
  });

  it('GET /sections/:id -> 404 cross-tenant (adminB)', async () => {
    const tokenA = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);
    const tokenB = await loginAndGetToken(app, ADMIN_B.identifier, ADMIN_B.password);

    const created = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-cross',
        groupLabel: 'E2E-cross',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`${SECTIONS_BASE}/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('PATCH /sections/:id -> 409 unique conflict (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    // Crear section 1
    const s1 = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-u1',
        groupLabel: 'E2E-u1',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    // Crear section 2 distinta
    const s2 = await request(app.getHttpServer())
      .post(SECTIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-u2',
        groupLabel: 'E2E-u2',
        primaryTeacherId: teacherAId,
      })
      .expect(201);

    // Intentar hacer s2 igual a s1 -> 409
    await request(app.getHttpServer())
      .patch(`${SECTIONS_BASE}/${s2.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gradeLevel: s1.body.gradeLevel, groupLabel: s1.body.groupLabel })
      .expect(409);
  });
});
