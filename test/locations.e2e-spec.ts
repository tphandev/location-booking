import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/create-test-app';

describe('Locations (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let adminToken: string;
  let userToken: string;

  const adminCreds = {
    username: 'loc_admin',
    email: 'loc_admin@test.com',
    password: 'password123',
    department: 'EFM',
    role: 'admin',
  };

  const userCreds = {
    username: 'loc_user',
    email: 'loc_user@test.com',
    password: 'password123',
    department: 'EFM',
    role: 'user',
  };

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(adminCreds);
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminCreds.email, password: adminCreds.password });
    adminToken = (adminLogin.body as Record<string, string>).access_token;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userCreds);
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userCreds.email, password: userCreds.password });
    userToken = (userLogin.body as Record<string, string>).access_token;
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function post(path: string, body: Record<string, unknown>, token: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function get(path: string, token: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);
  }

  function patch(path: string, body: Record<string, unknown>, token: string) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function del(path: string, token: string) {
    return request(app.getHttpServer())
      .delete(path)
      .set('Authorization', `Bearer ${token}`);
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────

  it('GET /locations → 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/locations').expect(401);
  });

  // ── CRUD ───────────────────────────────────────────────────────────────────

  let buildingId: string;
  let floorId: string;
  let roomId: string;

  it('POST /locations → 201 creates a building (admin)', async () => {
    const res = await post(
      '/api/v1/locations',
      {
        locationNumber: 'BLD-A',
        locationName: 'Building A',
        building: 'A',
      },
      adminToken,
    ).expect(201);

    const body = res.body as Record<string, unknown>;
    expect(body.locationNumber).toBe('BLD-A');
    expect(body.parentId).toBeNull();
    buildingId = body.id as string;
  });

  it('POST /locations → 201 creates a floor under building', async () => {
    const res = await post(
      '/api/v1/locations',
      {
        locationNumber: 'BLD-A-01',
        locationName: 'Floor 1',
        building: 'A',
        parentId: buildingId,
      },
      adminToken,
    ).expect(201);

    floorId = (res.body as Record<string, string>).id;
  });

  it('POST /locations → 201 creates a bookable room under floor', async () => {
    const res = await post(
      '/api/v1/locations',
      {
        locationNumber: 'BLD-A-01-001',
        locationName: 'Meeting Room Alpha',
        building: 'A',
        parentId: floorId,
        department: 'EFM',
        capacity: 10,
        openTime: {
          type: 'scheduled',
          daysFrom: 'Mon',
          daysTo: 'Fri',
          openHour: 9,
          closeHour: 18,
        },
      },
      adminToken,
    ).expect(201);

    const body = res.body as Record<string, unknown>;
    expect(body.department).toBe('EFM');
    expect(body.capacity).toBe(10);
    roomId = body.id as string;
  });

  it('POST /locations → 403 for non-admin user', async () => {
    await post(
      '/api/v1/locations',
      { locationNumber: 'X', locationName: 'X', building: 'X' },
      userToken,
    ).expect(403);
  });

  it('POST /locations → 400 when location number is duplicate', async () => {
    await post(
      '/api/v1/locations',
      { locationNumber: 'BLD-A', locationName: 'Duplicate', building: 'A' },
      adminToken,
    ).expect(400);
  });

  it('GET /locations → 200 returns paginated list', async () => {
    const res = await get('/api/v1/locations', adminToken).expect(200);
    const body = res.body as { data: unknown[]; meta: Record<string, number> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    expect(body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('GET /locations?building=A → filters by building', async () => {
    const res = await get('/api/v1/locations?building=A', adminToken).expect(
      200,
    );
    const body = res.body as { data: Array<Record<string, unknown>> };
    expect(body.data.every((l) => l.building === 'A')).toBe(true);
  });

  it('GET /locations/tree → returns nested tree', async () => {
    const res = await get('/api/v1/locations/tree', adminToken).expect(200);
    const tree = res.body as Array<Record<string, unknown>>;
    expect(Array.isArray(tree)).toBe(true);

    const bldNode = tree.find((n) => n.id === buildingId);
    expect(bldNode).toBeDefined();

    const children = bldNode!.children as Array<Record<string, unknown>>;
    expect(children.length).toBe(1);
    expect(children[0].id).toBe(floorId);

    const grandchildren = children[0].children as Array<
      Record<string, unknown>
    >;
    expect(grandchildren.length).toBe(1);
    expect(grandchildren[0].id).toBe(roomId);
  });

  it('GET /locations/:id → 200 returns location with children', async () => {
    const res = await get(`/api/v1/locations/${floorId}`, adminToken).expect(
      200,
    );
    const body = res.body as Record<string, unknown>;
    expect(body.id).toBe(floorId);
    expect(Array.isArray(body.children)).toBe(true);
    expect((body.children as unknown[]).length).toBe(1);
  });

  it('GET /locations/:id → 404 for unknown id', async () => {
    await get(
      '/api/v1/locations/00000000-0000-0000-0000-000000000000',
      adminToken,
    ).expect(404);
  });

  it('PATCH /locations/:id → 200 updates location name', async () => {
    const res = await patch(
      `/api/v1/locations/${roomId}`,
      { locationName: 'Renamed Room Alpha' },
      adminToken,
    ).expect(200);

    expect((res.body as Record<string, unknown>).locationName).toBe(
      'Renamed Room Alpha',
    );
  });

  it('PATCH /locations/:id → 403 for non-admin', async () => {
    await patch(
      `/api/v1/locations/${roomId}`,
      { locationName: 'Try update' },
      userToken,
    ).expect(403);
  });

  // ── Cascade delete ──────────────────────────────────────────────────────────

  it('DELETE /locations/:id → 204 cascade soft-deletes floor + room', async () => {
    await del(`/api/v1/locations/${floorId}`, adminToken).expect(204);

    // Floor should be gone
    await get(`/api/v1/locations/${floorId}`, adminToken).expect(404);
    // Room (child) should also be gone
    await get(`/api/v1/locations/${roomId}`, adminToken).expect(404);
    // Building (parent) should still exist
    await get(`/api/v1/locations/${buildingId}`, adminToken).expect(200);
  });

  it('DELETE /locations/:id → 403 for non-admin', async () => {
    await del(`/api/v1/locations/${buildingId}`, userToken).expect(403);
  });

  it('DELETE /locations/:id → 404 on already-deleted', async () => {
    await del(`/api/v1/locations/${floorId}`, adminToken).expect(404);
  });
});
