import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Location } from '../locations/entities/location.entity';
import { LocationsService } from '../locations/locations.service';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { BookingValidatorService } from './booking-validator.service';
import { Booking } from './entities/booking.entity';

function makeLocation(overrides: Partial<Location> = {}): Location {
  return Object.assign(new Location(), {
    id: 'loc-1',
    locationNumber: 'ROOM-01',
    locationName: 'Test Room',
    building: 'A',
    parentId: null,
    parent: null,
    children: [],
    department: 'EFM',
    capacity: 10,
    openTime: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return Object.assign(new Booking(), {
    id: 'booking-existing',
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

describe('BookingValidatorService', () => {
  let service: BookingValidatorService;
  let locationsService: jest.Mocked<LocationsService>;
  let bookingRepo: { find: jest.Mock };

  // Monday 2026-06-08 10:00–12:00 UTC — well within Mon–Fri, 9–18
  const MON_START = new Date('2026-06-08T10:00:00.000Z');
  const MON_END = new Date('2026-06-08T12:00:00.000Z');
  const DEPT = 'EFM';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingValidatorService,
        {
          provide: LocationsService,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BookingValidatorService);
    locationsService = module.get(LocationsService);
    bookingRepo = module.get(getRepositoryToken(Booking));
  });

  // ── Rule 1: location exists and is bookable ─────────────────────────────────

  describe('Rule 1 — location bookability', () => {
    it('propagates NotFoundException when location does not exist', async () => {
      locationsService.findOne.mockRejectedValue(
        new NotFoundException('Location loc-1 not found'),
      );
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when location has no department/capacity/openTime', async () => {
      locationsService.findOne.mockResolvedValue(
        makeLocation({ department: null, capacity: null, openTime: null }),
      );
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when only department is missing', async () => {
      locationsService.findOne.mockResolvedValue(
        makeLocation({ department: null }),
      );
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Rule 2: department match ────────────────────────────────────────────────

  describe('Rule 2 — department match', () => {
    it('throws BadRequestException when user department differs from location', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, 'FSS'),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes when departments match', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      bookingRepo.find.mockResolvedValue([]);
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).resolves.toBeDefined();
    });
  });

  // ── Rule 3: capacity ────────────────────────────────────────────────────────

  describe('Rule 3 — capacity', () => {
    it('throws BadRequestException when attendees exceed capacity', async () => {
      locationsService.findOne.mockResolvedValue(
        makeLocation({ capacity: 10 }),
      );
      await expect(
        service.validate('loc-1', 11, MON_START, MON_END, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes when attendees exactly equal capacity', async () => {
      locationsService.findOne.mockResolvedValue(
        makeLocation({ capacity: 10 }),
      );
      bookingRepo.find.mockResolvedValue([]);
      await expect(
        service.validate('loc-1', 10, MON_START, MON_END, DEPT),
      ).resolves.toBeDefined();
    });
  });

  // ── Rule 4: open schedule ───────────────────────────────────────────────────

  describe('Rule 4 — open schedule', () => {
    it('always-open location passes without day/hour checks', async () => {
      locationsService.findOne.mockResolvedValue(
        makeLocation({ openTime: { type: 'always' } }),
      );
      bookingRepo.find.mockResolvedValue([]);
      // Sunday, unusual hour — would fail a scheduled check
      const sun = new Date('2026-06-07T07:00:00.000Z');
      const sunEnd = new Date('2026-06-07T08:00:00.000Z');
      await expect(
        service.validate('loc-1', 5, sun, sunEnd, DEPT),
      ).resolves.toBeDefined();
    });

    it('throws when booking day falls on a weekend (Sunday)', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      const sun = new Date('2026-06-07T10:00:00.000Z');
      const sunEnd = new Date('2026-06-07T12:00:00.000Z');
      await expect(
        service.validate('loc-1', 5, sun, sunEnd, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when booking starts before openHour', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      const earlyStart = new Date('2026-06-08T08:00:00.000Z'); // 08:00, before openHour=9
      await expect(
        service.validate('loc-1', 5, earlyStart, MON_END, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when booking ends after closeHour', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      const lateEnd = new Date('2026-06-08T19:00:00.000Z'); // 19:00, after closeHour=18
      await expect(
        service.validate('loc-1', 5, MON_START, lateEnd, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes for booking exactly at open boundaries (09:00–18:00)', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      bookingRepo.find.mockResolvedValue([]);
      const boundaryStart = new Date('2026-06-08T09:00:00.000Z');
      const boundaryEnd = new Date('2026-06-08T18:00:00.000Z');
      await expect(
        service.validate('loc-1', 5, boundaryStart, boundaryEnd, DEPT),
      ).resolves.toBeDefined();
    });

    it('throws when booking crosses midnight (endTime on the next UTC day)', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      // 19:00 Mon → 01:00 Tue — endFrac would wrap to 1, previously bypassing closeHour check
      const lateStart = new Date('2026-06-08T19:00:00.000Z');
      const nextDayEnd = new Date('2026-06-09T01:00:00.000Z');
      await expect(
        service.validate('loc-1', 5, lateStart, nextDayEnd, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when booking crosses a day boundary into a disallowed day (Fri→Sat)', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      // 22:00 Fri → 02:00 Sat — day check on startTime alone would pass (Friday is valid)
      const fridayNight = new Date('2026-06-12T22:00:00.000Z');
      const saturdayMorning = new Date('2026-06-13T02:00:00.000Z');
      await expect(
        service.validate('loc-1', 5, fridayNight, saturdayMorning, DEPT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Rule 5: no overlap ──────────────────────────────────────────────────────

  describe('Rule 5 — no overlap', () => {
    it('throws when an existing booking fully overlaps the new slot', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      bookingRepo.find.mockResolvedValue([
        makeBooking({ startTime: MON_START, endTime: MON_END }),
      ]);
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when an existing booking partially overlaps (starts inside new slot)', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      bookingRepo.find.mockResolvedValue([
        makeBooking({
          startTime: new Date('2026-06-08T11:00:00.000Z'),
          endTime: new Date('2026-06-08T13:00:00.000Z'),
        }),
      ]);
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not conflict when existing booking ends exactly when new one starts', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      // SQL uses strict inequality (endTime > startTime), so a touching booking
      // whose endTime = newStart is never returned by the DB query.
      bookingRepo.find.mockResolvedValue([]);
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).resolves.toBeDefined();
    });

    it('does not conflict when existing booking starts exactly when new one ends', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      // SQL uses strict inequality (startTime < endTime), so a touching booking
      // whose startTime = newEnd is never returned by the DB query.
      bookingRepo.find.mockResolvedValue([]);
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT),
      ).resolves.toBeDefined();
    });

    it('skips the excluded booking ID when re-validating an update', async () => {
      locationsService.findOne.mockResolvedValue(makeLocation());
      const ownBooking = makeBooking({
        id: 'booking-self',
        startTime: MON_START,
        endTime: MON_END,
      });
      bookingRepo.find.mockResolvedValue([ownBooking]);
      // Same slot as existing own booking — should pass because it's excluded
      await expect(
        service.validate('loc-1', 5, MON_START, MON_END, DEPT, 'booking-self'),
      ).resolves.toBeDefined();
    });
  });
});
