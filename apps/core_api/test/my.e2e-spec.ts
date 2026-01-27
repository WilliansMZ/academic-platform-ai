import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loginAndGetToken } from './helpers/auth';
import { PrismaService } from '../src/prisma/prisma.service';
import { SectionStatus, EnrollmentStatus } from '@prisma/client';

describe('My (E2E) - HU-04.4', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_A = { identifier: 'admin@demo.edu', password: 'Admin12345!' };
  const ADMIN_B = { identifier: 'admin-b@demo.edu', password: 'Admin12345!' };
  const TEACHER_A = { identifier: 'teacher@demo.edu', password: 'Admin12345!' };
  const STUDENT_A = { identifier: 'student@demo.edu', password: 'Admin12345!' };

  const MY_COURSES = '/api/v1/my/courses';

  // IDs resueltos desde seed (sin hardcode)
  let institutionAId: string;
  let academicYearAId: string;
  let subjectAId: string;
  let teacherAId: string;
  let studentAId: string;

  // data E2E creada
  let e2eSectionId: string;

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
    // 1) Borrar enrollments E2E (depende de Section)
    // 2) Borrar section E2E
    await prisma.enrollment.deleteMany({
      where: {
        institutionId: institutionAId,
        section: {
          OR: [
            { gradeLevel: { startsWith: 'E2E-' } },
            { groupLabel: { startsWith: 'E2E-' } },
          ],
        },
      },
    });

    await prisma.section.deleteMany({
      where: {
        institutionId: institutionAId,
        OR: [
          { gradeLevel: { startsWith: 'E2E-' } },
          { groupLabel: { startsWith: 'E2E-' } },
        ],
      },
    });

    // ========= Seed mínimo para HU-04.4 (idempotente) =========
    // Creamos 1 Section ACTIVE donde teacherA es primary
    const section = await prisma.section.create({
      data: {
        institutionId: institutionAId,
        academicYearId: academicYearAId,
        subjectId: subjectAId,
        gradeLevel: 'E2E-MY-5',
        groupLabel: 'E2E-MY-A',
        primaryTeacherId: teacherAId,
        status: SectionStatus.ACTIVE,
      },
      select: { id: true },
    });
    e2eSectionId = section.id;

    // Creamos enrollment ACTIVE studentA en esa section
    await prisma.enrollment.create({
      data: {
        institutionId: institutionAId,
        sectionId: e2eSectionId,
        studentId: studentAId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    // (Opcional) Crear link SectionTeacher para cubrir caso assistant también:
    // si quieres probar dedupe, puedes insertar teacherA como ASSISTANT y seguir esperando 1 solo item.
    // await prisma.sectionTeacher.create({
    //   data: { sectionId: e2eSectionId, teacherId: teacherAId, role: 'ASSISTANT' },
    // });
  });

  afterAll(async () => {
    // Cleanup final
    await prisma.enrollment.deleteMany({
      where: { institutionId: institutionAId, sectionId: e2eSectionId },
    });

    await prisma.section.deleteMany({
      where: { institutionId: institutionAId, id: e2eSectionId },
    });

    await app.close();
  });

  it('GET /my/courses -> 401 no token', async () => {
    await request(app.getHttpServer()).get(MY_COURSES).expect(401);
  });

  it('GET /my/courses -> 403 for admin (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .get(MY_COURSES)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /my/courses -> 200 for teacher (teacherA)', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    const res = await request(app.getHttpServer())
      .get(MY_COURSES)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Debe existir al menos el curso E2E
    const found = res.body.data.find((x: any) => x.section?.id === e2eSectionId);
    expect(found).toBeTruthy();

    expect(found.myRole).toBe('TEACHER');
    expect(found.section.gradeLevel).toBe('E2E-MY-5');
    expect(found.section.groupLabel).toBe('E2E-MY-A');
    expect(found.section.status).toBe('ACTIVE');

    expect(found.subject).toHaveProperty('id');
    expect(found.subject).toHaveProperty('name');

    expect(found.academicYear).toHaveProperty('id');
    expect(found.academicYear).toHaveProperty('name');
  });

  it('GET /my/courses -> 200 for student (studentA)', async () => {
    const token = await loginAndGetToken(app, STUDENT_A.identifier, STUDENT_A.password);

    const res = await request(app.getHttpServer())
      .get(MY_COURSES)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find((x: any) => x.section?.id === e2eSectionId);
    expect(found).toBeTruthy();

    expect(found.myRole).toBe('STUDENT');
    expect(found.section.status).toBe('ACTIVE');
  });

  it('GET /my/courses -> tenant isolation (adminB should not see tenant A data even if forced)', async () => {
    // Nota: adminB está prohibido (403) por RBAC,
    // pero este test sirve como recordatorio de que "my" siempre está tenant-scoped.
    const tokenB = await loginAndGetToken(app, ADMIN_B.identifier, ADMIN_B.password);

    await request(app.getHttpServer())
      .get(MY_COURSES)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });
});
