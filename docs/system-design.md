# System Design

## Overview

A RESTful API backend for building location management and room booking, built with NestJS + TypeScript + TypeORM + PostgreSQL.

---

## Architecture Diagram

```mermaid
graph LR
    Client["🖥️ Client\n(REST / Swagger UI)"]

    subgraph API["NestJS REST API :3000"]
        Auth["Auth Module"]
        Locations["Locations Module"]
        Bookings["Bookings Module"]
    end

    DB[("🗄️ PostgreSQL\n:5432")]

    Client -->|"HTTP/JSON\nBearer JWT"| API
    Auth --> DB
    Locations --> DB
    Bookings --> DB
```

---

## Module Breakdown

### Auth Module
- **AuthController** — `POST /auth/register`, `POST /auth/login`
- **AuthService** — password hashing (bcrypt), JWT signing, credential validation
- **JwtStrategy** — validates bearer token, attaches `{ id, email, role, department }` to `request.user`
- **JwtAuthGuard** — protects routes, returns 401 if token missing/invalid
- **RolesGuard** — reads `@Roles(Role.Admin)` decorator, returns 403 if role insufficient
- **@CurrentUser()** — parameter decorator to extract user from request cleanly

### Users Module
- **UsersService** — `findByEmail()`, `findById()`, `create()` — used internally by Auth

### Locations Module
- **LocationsController** — CRUD endpoints + tree endpoint
- **LocationsService** — tree building (recursive), soft-delete cascade (recursively collects all child IDs before bulk soft-delete)

### Bookings Module
- **BookingsController** — CRUD endpoints, scoped by role (admin sees all, user sees own)
- **BookingsService** — orchestrates validation then persistence
- **BookingValidatorService** — 5 sequential validation rules (see Booking Validation Flow below)

### Common
| Component | Purpose |
|-----------|---------|
| `AllExceptionsFilter` | Catches all errors, returns consistent `{ statusCode, message, error, path, timestamp }` |
| `LoggingInterceptor` | Logs `[METHOD] /path → status (Xms)` on every request |
| `TransformInterceptor` | Wraps 2xx responses: `{ data: T, meta?: PaginationMeta }` |
| `ThrottlerGuard` | Global rate limit: 100 requests / 60 seconds |

---

## Request Lifecycle

```mermaid
flowchart LR
    Req([HTTP Request])
    Throttle[ThrottlerGuard\n100 req/60s]
    Helmet[Helmet + CORS]
    Log[LoggingInterceptor\nstart timer]
    JWT[JwtAuthGuard\nvalidate token]
    Roles[RolesGuard\ncheck role]
    Ctrl[Controller\nparse + validate DTO]
    Svc[Service\nbusiness logic]
    Repo[TypeORM Repository]
    PG[(PostgreSQL)]
    Wrap[TransformInterceptor\nwrap response]
    Res([HTTP Response])

    Req --> Throttle --> Helmet --> Log --> JWT --> Roles --> Ctrl --> Svc --> Repo --> PG
    PG --> Repo --> Svc --> Ctrl --> Wrap --> Res
```

Any step can throw — the `AllExceptionsFilter` catches all unhandled errors and formats them before the response leaves.

---

## Booking Validation Flow

```mermaid
flowchart TD
    Start([POST /api/v1/bookings])
    R1{"Rule 1\nLocation exists,\nnot deleted,\nand is bookable?"}
    R2{"Rule 2\nuser.department\n=== location.department?"}
    R3{"Rule 3\nattendees\n<= capacity?"}
    R4{"Rule 4\nBooking time within\nopen days & hours?"}
    R5{"Rule 5\nNo overlapping\nactive booking?"}
    OK([201 Created])

    E1[400: Location not found\nor not bookable]
    E2[400: Department mismatch\nUser dept does not match room]
    E3[400: Exceeds capacity\nRoom holds N people]
    E4[400: Outside operating hours\nRoom is closed at that time]
    E5[409: Time slot unavailable\nRoom already booked]

    Start --> R1
    R1 -->|No| E1
    R1 -->|Yes| R2
    R2 -->|No| E2
    R2 -->|Yes| R3
    R3 -->|No| E3
    R3 -->|Yes| R4
    R4 -->|No| E4
    R4 -->|Yes| R5
    R5 -->|No| E5
    R5 -->|Yes| OK
```

---

## API Versioning & Base Path

All endpoints are prefixed with `/api/v1`.

| Module | Base Path |
|--------|-----------|
| Auth | `/api/v1/auth` |
| Locations | `/api/v1/locations` |
| Bookings | `/api/v1/bookings` |
| Health | `/api/v1/health` |
| Docs | `/api/docs` (Swagger UI) |

---

## Tech Stack Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Framework | NestJS | Module-based architecture maps cleanly to domain boundaries. DI container simplifies testing. |
| ORM | TypeORM | Decorator-based entities, migration support, repository pattern. |
| Tree storage | Adjacency list (`parentId` FK) | Simple to query, easy to understand. Recursive service method handles tree building and cascade deletes in application layer — avoids complex DB-level recursive CTEs for this scale. |
| Soft delete | `deletedAt` timestamp | Preserves audit history. Cascade implemented in service: on delete, recursively fetch all descendant IDs, bulk-set `deletedAt`. |
| openTime storage | JSONB column | Flexible schema for `scheduled` vs `always` types without extra tables. Queried only at validation time, not for indexing. |
| Auth | JWT (stateless) | No session storage needed. Token carries `{ id, role, department }` — department matching happens without extra DB lookup. |
| Roles | Enum guard (`admin` / `user`) | Admin manages locations; users make bookings. Clean separation. |
| Password hashing | bcrypt (rounds: 10) | Industry standard. Resistant to brute force. |
| Validation | `class-validator` + `ValidationPipe` | Declarative DTO validation. Errors auto-formatted before reaching controller. |
