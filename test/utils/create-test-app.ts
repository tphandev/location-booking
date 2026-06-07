import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataType, newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Booking } from '../../src/bookings/entities/booking.entity';
import { Location } from '../../src/locations/entities/location.entity';
import { User } from '../../src/users/entities/user.entity';

async function buildPgMemDataSource(): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 14.0 (pg-mem)',
  });

  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'test',
  });

  db.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: DataType.uuid,
    impure: true,
    implementation: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }),
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const dataSource: DataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [User, Location, Booking],
    synchronize: true,
  });

  await dataSource.initialize();
  return dataSource;
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
  moduleFixture: TestingModule;
}> {
  const dataSource = await buildPgMemDataSource();

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getDataSourceToken())
    .useValue(dataSource)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, dataSource, moduleFixture };
}
