import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loginAndGetToken } from './helpers/auth';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Subjects (E2E) - HU-04.1', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ADMIN_A = { identifier: 'admin@demo.edu', password: 'Admin12345!' };
  const ADMIN_B = { identifier: 'admin-b@demo.edu', password: 'Admin12345!' };
  const TEACHER_A = { identifier: 'teacher@demo.edu', password: 'Admin12345!' };

  const SUBJECTS_BASE = '/api/v1/subjects';

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

    // ✅ Prisma desde DI (misma config que prod)
    prisma = app.get(PrismaService);

    // ✅ cleanup SOLO data E2E
    await prisma.subject.deleteMany({
      where: { name: { startsWith: 'E2E ' } },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /subjects -> 201 (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Matemática I' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('E2E Matemática I');
  });

  it('POST /subjects -> 409 duplicate same tenant (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Duplicado' })
      .expect(201);

    await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Duplicado' })
      .expect(409);
  });

  it('POST /subjects -> 201 same name allowed in other tenant (adminB)', async () => {
    const tokenA = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);
    const tokenB = await loginAndGetToken(app, ADMIN_B.identifier, ADMIN_B.password);

    await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'E2E MultiTenant' })
      .expect(201);

    await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'E2E MultiTenant' })
      .expect(201);
  });

  it('GET /subjects -> 200 + meta (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const res = await request(app.getHttpServer())
      .get(`${SUBJECTS_BASE}?page=1&pageSize=10&search=E2E&sortBy=name&sortOrder=asc`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(10);
  });

  it('GET /subjects/:id -> 404 cross-tenant (adminB)', async () => {
    const tokenA = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);
    const tokenB = await loginAndGetToken(app, ADMIN_B.identifier, ADMIN_B.password);

    const created = await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'E2E CrossTenant' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`${SUBJECTS_BASE}/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('PATCH /subjects/:id -> 200 update (adminA)', async () => {
    const token = await loginAndGetToken(app, ADMIN_A.identifier, ADMIN_A.password);

    const created = await request(app.getHttpServer())
      .post(SUBJECTS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Update Base' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`${SUBJECTS_BASE}/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E Update Nuevo' })
      .expect(200);

    expect(updated.body.name).toBe('E2E Update Nuevo');
  });

  it('GET /subjects -> 403 for teacher', async () => {
    const token = await loginAndGetToken(app, TEACHER_A.identifier, TEACHER_A.password);

    await request(app.getHttpServer())
      .get(`${SUBJECTS_BASE}?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /subjects -> 401 no token', async () => {
    await request(app.getHttpServer())
      .get(`${SUBJECTS_BASE}?page=1&pageSize=10`)
      .expect(401);
  });
});
