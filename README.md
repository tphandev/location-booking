# SJ Group — Building Location & Booking API

RESTful API for managing building locations and room bookings, built as a Surbana Jurong interview assignment.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | NestJS + TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL 15 |
| Auth | JWT (Bearer) + bcrypt |
| Validation | class-validator + ValidationPipe |
| Docs | Swagger / OpenAPI 3 |
| Container | Docker Compose |

---

## Quick Start

### Prerequisites
- Docker Desktop (for PostgreSQL)
- Node.js 20+

### 1 — Clone & install

```bash
git clone <repo-url>
cd sjgroup-assigment
npm install
```

### 2 — Configure environment

```bash
cp .env.example .env
# Edit .env if needed — defaults work with the Docker Compose setup
```

### 3 — Start PostgreSQL

```bash
docker compose up postgres -d
```

### 4 — Run migrations

```bash
npm run migration:run
```

### 5 — Seed data

```bash
npm run seed
```

### 6 — Start the API

```bash
npm run start:dev
```

The API is now available at `http://localhost:3000/api/v1`.  
Swagger UI: `http://localhost:3000/api/docs`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | HTTP port |
| `API_PREFIX` | `api/v1` | Global route prefix |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `sjgroup` | PostgreSQL database name |
| `JWT_SECRET` | *(required)* | Signing secret — min 16 chars |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `THROTTLE_TTL` | `60000` | Rate-limit window in ms |
| `THROTTLE_LIMIT` | `100` | Max requests per window |

---

## Test Credentials

All seeded accounts use password **`Password123!`**

| Username | Email | Department | Role |
|----------|-------|------------|------|
| `admin` | admin@sjgroup.com | EFM | **admin** |
| `efm_user` | efm@sjgroup.com | EFM | user |
| `fss_user` | fss@sjgroup.com | FSS | user |
| `avs_user` | avs@sjgroup.com | AVS | user |
| `ass_user` | ass@sjgroup.com | ASS | user |

### Bookable rooms (seeded)

| Location # | Name | Dept | Capacity | Schedule |
|------------|------|------|----------|----------|
| A-01-01 | Meeting Room 1 | EFM | 10 | Mon–Fri 09:00–18:00 UTC |
| A-01-02 | Meeting Room 2 | AVS | 8 | Mon–Sat 09:00–18:00 UTC |
| A-02-01 | Meeting Room 3 | FSS | 6 | Mon–Fri 09:00–18:00 UTC |
| A-02-02 | Meeting Room 4 | EFM | 12 | Mon–Fri 09:00–18:00 UTC |
| B-05-11 | Utility Room | ASS | 4 | Always open |
| B-05-13 | Genset Room | ASS | 2 | Mon–Sun 09:00–18:00 UTC |

---

## API Endpoints

All routes are prefixed with `/api/v1`. All except `POST /auth/register` and `POST /auth/login` require a `Bearer` token.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register a new user |
| POST | `/auth/login` | — | Login → `{ access_token }` |
| GET | `/auth/me` | User | Current user info |

### Locations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/locations` | User | Paginated flat list (`?building=A&page=1&limit=20`) |
| GET | `/locations/tree` | User | Full nested tree |
| GET | `/locations/:id` | User | Single location with children |
| POST | `/locations` | **Admin** | Create a location |
| PATCH | `/locations/:id` | **Admin** | Update a location |
| DELETE | `/locations/:id` | **Admin** | Soft-delete location + all descendants |

### Bookings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/bookings` | User | Own bookings (admin sees all) |
| GET | `/bookings/:id` | User | Own booking (admin sees any) |
| POST | `/bookings` | User | Create booking (5-rule validation) |
| PATCH | `/bookings/:id` | User | Update own booking (re-validates) |
| DELETE | `/bookings/:id` | User | Cancel own booking (soft-delete) |

### Booking Validation Rules

Every `POST /bookings` and `PATCH /bookings/:id` runs these checks in order:

1. Location exists, is not deleted, and has `department` + `capacity` + `openTime` set
2. `user.department` matches `location.department`
3. `attendees` ≤ `location.capacity`
4. Booking day and time fall within the location's open schedule (UTC); start and end must be on the same calendar day
5. No overlapping active booking exists for that location

---

## Running Tests

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests (uses in-memory pg-mem — no Docker needed)
npm run test:e2e

# E2E tests against real PostgreSQL
npm run test:e2e:db
```

---

## Database Migrations

```bash
# Apply all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Show migration status
npm run migration:show

# Generate a new migration from entity changes
npm run migration:generate -- src/database/migrations/<MigrationName>
```

---

## Design Documentation

- [System Design](docs/system-design.md) — architecture diagram, module breakdown, request lifecycle, booking validation flow
- [Database Design](docs/database-design.md) — ERD, full table definitions, `openTime` JSONB schema, index strategy

---

## Project Structure

```
src/
├── auth/               # JWT auth, guards, decorators
├── bookings/           # Booking CRUD + 5-rule validator
│   ├── dto/
│   ├── entities/
│   └── booking-validator.service.ts
├── common/
│   ├── enums/
│   ├── filters/        # AllExceptionsFilter
│   ├── interceptors/   # LoggingInterceptor, TransformInterceptor
│   └── interfaces/
├── config/             # database.config, jwt.config
├── database/
│   ├── migrations/
│   └── seeds/          # npm run seed
├── locations/          # Location CRUD + tree + cascade delete
└── users/              # UsersService (internal)
```
