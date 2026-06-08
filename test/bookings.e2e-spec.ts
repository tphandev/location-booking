import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/create-test-app';

describe('Bookings (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let adminToken: string;
  let efmToken: string;
  let fssToken: string;

  let bookableRoomId: string;
  let nonBookableRoomId: string;
  let bookingId: string;

  // Tuesday 2026-06-09 10:00–12:00 UTC (Mon–Fri, within 9–18) — main booking slot
  const TUESDAY_START = '2026-06-09T10:00:00.000Z';
  const TUESDAY_END = '2026-06-09T12:00:00.000Z';

  // Monday 2026-06-08 10:00–12:00 UTC — used for one-off validation tests
  const MONDAY_START = '2026-06-08T10:00:00.000Z';
  const MONDAY_END = '2026-06-08T12:00:00.000Z';

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

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());

    // ── Register & login admin ──────────────────────────────────────────────
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      username: 'bk_admin',
      email: 'bk_admin@test.com',
      password: 'password123',
      department: 'EFM',
      role: 'admin',
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bk_admin@test.com', password: 'password123' });
    adminToken = (adminLogin.body as Record<string, string>).access_token;

    // ── Register & login EFM user ───────────────────────────────────────────
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      username: 'bk_efm',
      email: 'bk_efm@test.com',
      password: 'password123',
      department: 'EFM',
    });
    const efmLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bk_efm@test.com', password: 'password123' });
    efmToken = (efmLogin.body as Record<string, string>).access_token;

    // ── Register & login FSS user ───────────────────────────────────────────
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      username: 'bk_fss',
      email: 'bk_fss@test.com',
      password: 'password123',
      department: 'FSS',
    });
    const fssLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bk_fss@test.com', password: 'password123' });
    fssToken = (fssLogin.body as Record<string, string>).access_token;

    // ── Create a non-bookable location (no dept/capacity/openTime) ──────────
    const nbRes = await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationNumber: 'BK-LOBBY-00',
        locationName: 'Non-Bookable Lobby',
        building: 'C',
      });
    nonBookableRoomId = (nbRes.body as Record<string, string>).id;

    // ── Create a bookable EFM room (Mon–Fri 9–18, capacity 10) ─────────────
    const bkRes = await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationNumber: 'BK-ROOM-EFM',
        locationName: 'EFM Meeting Room',
        building: 'A',
        department: 'EFM',
        capacity: 10,
        openTime: {
          type: 'scheduled',
          daysFrom: 'Mon',
          daysTo: 'Fri',
          openHour: 9,
          closeHour: 18,
        },
      });
    bookableRoomId = (bkRes.body as Record<string, string>).id;
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  it('GET /bookings → 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/bookings').expect(401);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('POST /bookings → 201 creates booking (efmUser, Tue 10-12)', async () => {
    const res = await post(
      '/api/v1/bookings',
      {
        locationId: bookableRoomId,
        attendees: 5,
        startTime: TUESDAY_START,
        endTime: TUESDAY_END,
        title: 'Team sync',
      },
      efmToken,
    ).expect(201);

    const body = res.body as Record<string, unknown>;
    expect(body.id).toBeDefined();
    expect(body.status).toBe('active');
    expect(body.attendees).toBe(5);
    expect(body.title).toBe('Team sync');
    bookingId = body.id as string;
  });

  it('GET /bookings → 200 efmUser sees own bookings', async () => {
    const res = await get('/api/v1/bookings', efmToken).expect(200);
    const body = res.body as {
      data: Array<Record<string, unknown>>;
      meta: Record<string, number>;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('GET /bookings → 200 fssUser sees empty list (no own bookings)', async () => {
    const res = await get('/api/v1/bookings', fssToken).expect(200);
    const body = res.body as { data: unknown[] };
    expect(body.data.length).toBe(0);
  });

  it('GET /bookings → 200 admin sees all bookings', async () => {
    const res = await get('/api/v1/bookings', adminToken).expect(200);
    const body = res.body as { data: unknown[] };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /bookings/:id → 200 efmUser retrieves own booking', async () => {
    const res = await get(`/api/v1/bookings/${bookingId}`, efmToken).expect(
      200,
    );
    const body = res.body as Record<string, unknown>;
    expect(body.id).toBe(bookingId);
    expect(body.title).toBe('Team sync');
  });

  it('GET /bookings/:id → 403 fssUser cannot access efmUser booking', async () => {
    await get(`/api/v1/bookings/${bookingId}`, fssToken).expect(403);
  });

  it('GET /bookings/:id → 200 admin can access any booking', async () => {
    const res = await get(`/api/v1/bookings/${bookingId}`, adminToken).expect(
      200,
    );
    expect((res.body as Record<string, unknown>).id).toBe(bookingId);
  });

  it('PATCH /bookings/:id → 200 efmUser updates own booking title', async () => {
    const res = await patch(
      `/api/v1/bookings/${bookingId}`,
      { title: 'Updated title' },
      efmToken,
    ).expect(200);
    expect((res.body as Record<string, unknown>).title).toBe('Updated title');
  });

  // ── Validation rules ──────────────────────────────────────────────────────

  it('Rule 1 → 400 when location is not bookable', async () => {
    await post(
      '/api/v1/bookings',
      {
        locationId: nonBookableRoomId,
        attendees: 2,
        startTime: MONDAY_START,
        endTime: MONDAY_END,
      },
      efmToken,
    ).expect(400);
  });

  it('Rule 2 → 400 when user department does not match location', async () => {
    await post(
      '/api/v1/bookings',
      {
        locationId: bookableRoomId, // EFM room
        attendees: 2,
        startTime: MONDAY_START,
        endTime: MONDAY_END,
      },
      fssToken, // FSS user
    ).expect(400);
  });

  it('Rule 3 → 400 when attendees exceed location capacity', async () => {
    await post(
      '/api/v1/bookings',
      {
        locationId: bookableRoomId, // capacity = 10
        attendees: 99,
        startTime: MONDAY_START,
        endTime: MONDAY_END,
      },
      efmToken,
    ).expect(400);
  });

  it('Rule 4a → 400 when booking falls on a weekend', async () => {
    // 2026-06-07 is a Sunday
    await post(
      '/api/v1/bookings',
      {
        locationId: bookableRoomId,
        attendees: 2,
        startTime: '2026-06-07T10:00:00.000Z',
        endTime: '2026-06-07T12:00:00.000Z',
      },
      efmToken,
    ).expect(400);
  });

  it('Rule 4b → 400 when booking is outside open hours', async () => {
    // 7:00–8:00 UTC is before openHour=9
    await post(
      '/api/v1/bookings',
      {
        locationId: bookableRoomId,
        attendees: 2,
        startTime: '2026-06-08T07:00:00.000Z',
        endTime: '2026-06-08T08:00:00.000Z',
      },
      efmToken,
    ).expect(400);
  });

  it('Rule 5 → 400 when booking overlaps an existing active booking', async () => {
    // bookingId (Tue 10-12) is still active — same slot should be rejected
    await post(
      '/api/v1/bookings',
      {
        locationId: bookableRoomId,
        attendees: 3,
        startTime: TUESDAY_START,
        endTime: TUESDAY_END,
      },
      efmToken,
    ).expect(400);
  });

  // ── Cancel ────────────────────────────────────────────────────────────────

  it('DELETE /bookings/:id → 403 fssUser cannot cancel efmUser booking', async () => {
    await del(`/api/v1/bookings/${bookingId}`, fssToken).expect(403);
  });

  it('DELETE /bookings/:id → 204 efmUser cancels own booking', async () => {
    await del(`/api/v1/bookings/${bookingId}`, efmToken).expect(204);
  });

  it('GET /bookings/:id → 404 after cancellation', async () => {
    await get(`/api/v1/bookings/${bookingId}`, efmToken).expect(404);
  });
});
