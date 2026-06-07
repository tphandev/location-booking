import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const testUser = {
    username: 'e2e_user',
    email: 'e2e@example.com',
    password: 'secret123',
    department: 'EFM',
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns user info without password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      const body = res.body as Record<string, unknown>;
      expect(body['email']).toBe(testUser.email);
      expect(body).not.toHaveProperty('password');
    });

    it('returns 409 when email already registered', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('returns 400 on invalid payload (missing email)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username: 'test', password: '123456', department: 'EFM' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns access_token on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body['access_token']).toBeDefined();
      expect((body['user'] as Record<string, unknown>)['email']).toBe(
        testUser.email,
      );
    });

    it('returns 401 on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 on unknown email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'secret123' })
        .expect(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns current user info when token is valid', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const loginBody = loginRes.body as Record<string, unknown>;

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${String(loginBody['access_token'])}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body['email']).toBe(testUser.email);
      expect(body['department']).toBe(testUser.department);
    });
  });
});
