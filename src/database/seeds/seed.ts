/**
 * Seed script — run with: npm run seed
 *
 * Inserts 5 users + full Building A & B hierarchy (idempotent — skips rows
 * that already exist, identified by unique keys).
 */

import { config } from 'dotenv';
config();

import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../../users/entities/user.entity';
import { Location } from '../../locations/entities/location.entity';
import { Role } from '../../common/enums/role.enum';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(
  repo: ReturnType<typeof AppDataSource.getRepository<User>>,
  data: Partial<User> & { password: string },
): Promise<void> {
  const existing = await repo.findOne({ where: { email: data.email } });
  if (existing) return;
  const hashed = await bcrypt.hash(data.password, 10);
  await repo.save(repo.create({ ...data, password: hashed }));
}

async function upsertLocation(
  repo: ReturnType<typeof AppDataSource.getRepository<Location>>,
  data: Partial<Location>,
): Promise<Location> {
  const existing = await repo.findOne({
    where: { locationNumber: data.locationNumber },
  });
  if (existing) return existing;
  return repo.save(repo.create(data));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database');

  const userRepo = AppDataSource.getRepository(User);
  const locRepo = AppDataSource.getRepository(Location);

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('\nSeeding users…');

  const PASS = 'Password123!';

  await upsertUser(userRepo, {
    username: 'admin',
    email: 'admin@sjgroup.com',
    password: PASS,
    department: 'EFM',
    role: Role.Admin,
  });

  await upsertUser(userRepo, {
    username: 'efm_user',
    email: 'efm@sjgroup.com',
    password: PASS,
    department: 'EFM',
    role: Role.User,
  });

  await upsertUser(userRepo, {
    username: 'fss_user',
    email: 'fss@sjgroup.com',
    password: PASS,
    department: 'FSS',
    role: Role.User,
  });

  await upsertUser(userRepo, {
    username: 'avs_user',
    email: 'avs@sjgroup.com',
    password: PASS,
    department: 'AVS',
    role: Role.User,
  });

  await upsertUser(userRepo, {
    username: 'ass_user',
    email: 'ass@sjgroup.com',
    password: PASS,
    department: 'ASS',
    role: Role.User,
  });

  console.log('  ✔ 5 users ready  (password: Password123!)');

  // ── Building A ─────────────────────────────────────────────────────────────
  console.log('\nSeeding Building A…');

  const bldA = await upsertLocation(locRepo, {
    locationNumber: 'A',
    locationName: 'Building A',
    building: 'A',
    parentId: null,
  });

  const floorA01 = await upsertLocation(locRepo, {
    locationNumber: 'A-01',
    locationName: 'Level 1',
    building: 'A',
    parentId: bldA.id,
  });

  await upsertLocation(locRepo, {
    locationNumber: 'A-01-LBY',
    locationName: 'Lobby',
    building: 'A',
    parentId: floorA01.id,
  });

  await upsertLocation(locRepo, {
    locationNumber: 'A-01-01',
    locationName: 'Meeting Room 1',
    building: 'A',
    parentId: floorA01.id,
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

  await upsertLocation(locRepo, {
    locationNumber: 'A-01-02',
    locationName: 'Meeting Room 2',
    building: 'A',
    parentId: floorA01.id,
    department: 'AVS',
    capacity: 8,
    openTime: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Sat',
      openHour: 9,
      closeHour: 18,
    },
  });

  const floorA02 = await upsertLocation(locRepo, {
    locationNumber: 'A-02',
    locationName: 'Level 2',
    building: 'A',
    parentId: bldA.id,
  });

  await upsertLocation(locRepo, {
    locationNumber: 'A-02-01',
    locationName: 'Meeting Room 3',
    building: 'A',
    parentId: floorA02.id,
    department: 'FSS',
    capacity: 6,
    openTime: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    },
  });

  await upsertLocation(locRepo, {
    locationNumber: 'A-02-02',
    locationName: 'Meeting Room 4',
    building: 'A',
    parentId: floorA02.id,
    department: 'EFM',
    capacity: 12,
    openTime: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    },
  });

  console.log('  ✔ Building A  (2 floors, 4 bookable rooms, 1 lobby)');

  // ── Building B ─────────────────────────────────────────────────────────────
  console.log('\nSeeding Building B…');

  const bldB = await upsertLocation(locRepo, {
    locationNumber: 'B',
    locationName: 'Building B',
    building: 'B',
    parentId: null,
  });

  const floorB05 = await upsertLocation(locRepo, {
    locationNumber: 'B-05',
    locationName: 'Level 5',
    building: 'B',
    parentId: bldB.id,
  });

  await upsertLocation(locRepo, {
    locationNumber: 'B-05-11',
    locationName: 'Utility Room',
    building: 'B',
    parentId: floorB05.id,
    department: 'ASS',
    capacity: 4,
    openTime: { type: 'always' },
  });

  await upsertLocation(locRepo, {
    locationNumber: 'B-05-12',
    locationName: 'Sanitary Room',
    building: 'B',
    parentId: floorB05.id,
    // not bookable — no dept/capacity/openTime
  });

  await upsertLocation(locRepo, {
    locationNumber: 'B-05-13',
    locationName: 'Genset Room',
    building: 'B',
    parentId: floorB05.id,
    department: 'ASS',
    capacity: 2,
    openTime: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Sun',
      openHour: 9,
      closeHour: 18,
    },
  });

  console.log('  ✔ Building B  (1 floor, 2 bookable rooms, 1 non-bookable)');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Seed complete!

  Test credentials (all passwords: Password123!)
  ┌─────────────┬──────────────────────────┬────────┬────────┐
  │ Username    │ Email                    │ Dept   │ Role   │
  ├─────────────┼──────────────────────────┼────────┼────────┤
  │ admin       │ admin@sjgroup.com        │ EFM    │ admin  │
  │ efm_user    │ efm@sjgroup.com          │ EFM    │ user   │
  │ fss_user    │ fss@sjgroup.com          │ FSS    │ user   │
  │ avs_user    │ avs@sjgroup.com          │ AVS    │ user   │
  │ ass_user    │ ass@sjgroup.com          │ ASS    │ user   │
  └─────────────┴──────────────────────────┴────────┴────────┘

  Bookable rooms:
    A-01-01  Meeting Room 1  EFM  cap:10  Mon–Fri 09:00–18:00
    A-01-02  Meeting Room 2  AVS  cap:8   Mon–Sat 09:00–18:00
    A-02-01  Meeting Room 3  FSS  cap:6   Mon–Fri 09:00–18:00
    A-02-02  Meeting Room 4  EFM  cap:12  Mon–Fri 09:00–18:00
    B-05-11  Utility Room    ASS  cap:4   Always open
    B-05-13  Genset Room     ASS  cap:2   Mon–Sun 09:00–18:00

  Swagger UI → http://localhost:3000/api/docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
