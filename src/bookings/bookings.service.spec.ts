import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Role } from '../common/enums/role.enum';
import { BookingValidatorService } from './booking-validator.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';

const EFM_USER: JwtPayload = {
  sub: 'user-1',
  username: 'efm_user',
  email: 'efm@test.com',
  role: Role.User,
  department: 'EFM',
};

const CREATE_DTO: CreateBookingDto = {
  locationId: 'loc-1',
  attendees: 5,
  startTime: new Date('2026-06-09T10:00:00.000Z'),
  endTime: new Date('2026-06-09T12:00:00.000Z'),
};

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return Object.assign(new Booking(), {
    id: 'booking-1',
    locationId: 'loc-1',
    userId: 'user-1',
    attendees: 5,
    startTime: new Date('2026-06-09T10:00:00.000Z'),
    endTime: new Date('2026-06-09T12:00:00.000Z'),
    title: null,
    status: BookingStatus.Active,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

// Build a QueryFailedError carrying a specific PostgreSQL error code
function pgError(code: string): QueryFailedError {
  return Object.assign(
    new QueryFailedError('INSERT INTO ...', [], new Error()),
    { code },
  );
}

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    findAndCount: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingValidatorService,
          useValue: { validate: jest.fn().mockResolvedValue({ id: 'loc-1' }) },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            softDelete: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BookingsService);
    bookingRepo = module.get(getRepositoryToken(Booking));
  });

  // ── Concurrency: exclusion constraint (23P01) handling ─────────────────────

  describe('create — 23P01 exclusion constraint violation', () => {
    it('throws ConflictException when DB raises 23P01 on INSERT', async () => {
      bookingRepo.create.mockReturnValue(makeBooking());
      bookingRepo.save.mockRejectedValue(pgError('23P01'));

      await expect(service.create(EFM_USER, CREATE_DTO)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unrelated DB errors unchanged', async () => {
      bookingRepo.create.mockReturnValue(makeBooking());
      // 23505 = unique constraint violation (different problem)
      bookingRepo.save.mockRejectedValue(pgError('23505'));

      await expect(service.create(EFM_USER, CREATE_DTO)).rejects.toThrow(
        QueryFailedError,
      );
    });

    it('re-throws non-DB errors unchanged', async () => {
      bookingRepo.create.mockReturnValue(makeBooking());
      bookingRepo.save.mockRejectedValue(new Error('network timeout'));

      await expect(service.create(EFM_USER, CREATE_DTO)).rejects.toThrow(
        'network timeout',
      );
    });
  });

  describe('update — 23P01 exclusion constraint violation', () => {
    it('throws ConflictException when DB raises 23P01 on UPDATE', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      bookingRepo.save.mockRejectedValue(pgError('23P01'));

      const dto: UpdateBookingDto = { title: 'New title' };
      await expect(service.update('booking-1', EFM_USER, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── Ownership enforcement ──────────────────────────────────────────────────

  describe('findOne — ownership', () => {
    it('throws ForbiddenException when user tries to access another user booking', async () => {
      bookingRepo.findOne.mockResolvedValue(
        makeBooking({ userId: 'other-user' }),
      );

      await expect(service.findOne('booking-1', EFM_USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows admin to access any booking', async () => {
      bookingRepo.findOne.mockResolvedValue(
        makeBooking({ userId: 'other-user' }),
      );

      const admin: JwtPayload = { ...EFM_USER, role: Role.Admin };
      await expect(service.findOne('booking-1', admin)).resolves.toBeDefined();
    });
  });
});
