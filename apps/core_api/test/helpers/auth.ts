import request from 'supertest';

export async function loginAndGetToken(app: any, identifier: string, password: string) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ identifier, password })
    .expect(200);

  const token = res.body?.accessToken;
  if (!token) throw new Error('Login response does not include accessToken');
  return token as string;
}
