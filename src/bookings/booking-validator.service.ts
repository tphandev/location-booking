import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { DayOfWeek, OpenTime } from '../common/interfaces/open-time.interface';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Location } from '../locations/entities/location.entity';
import { LocationsService } from '../locations/locations.service';
import { Booking } from './entities/booking.entity';

const DAY_NUM: Record<DayOfWeek, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

// JS getUTCDay(): 0=Sun,1=Mon,...6=Sat — map to same scale as DAY_NUM
const JS_UTC_TO_DAY_NUM: Record<number, number> = {
  0: 7,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
};

@Injectable()
export class BookingValidatorService {
  constructor(
    private readonly locationsService: LocationsService,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async validate(
    locationId: string,
    attendees: number,
    startTime: Date,
    endTime: Date,
    userDepartment: string,
    excludeBookingId?: string,
  ): Promise<Location> {
    // Rule 1: Location exists, is not deleted, and has all bookable fields
    const location = await this.locationsService.findOne(locationId);
    if (!location.isBookable) {
      throw new BadRequestException(
        'Location is not bookable — it must have a department, capacity, and open schedule',
      );
    }

    // Rule 2: User's department must match the location's department
    if (location.department !== userDepartment) {
      throw new BadRequestException(
        `Your department (${userDepartment}) does not have access to this location (${location.department})`,
      );
    }

    // Rule 3: Attendees must not exceed capacity
    if (attendees > location.capacity!) {
      throw new BadRequestException(
        `Attendees (${attendees}) exceeds location capacity (${location.capacity})`,
      );
    }

    // Rule 4: Booking must be within the location's open schedule
    this.validateOpenTime(location.openTime!, startTime, endTime);

    // Rule 5: No overlapping active booking for this location
    await this.checkNoOverlap(locationId, startTime, endTime, excludeBookingId);

    return location;
  }

  private validateOpenTime(
    openTime: OpenTime,
    startTime: Date,
    endTime: Date,
  ): void {
    if (openTime.type === 'always') return;

    const { daysFrom, daysTo, openHour, closeHour } = openTime;

    // Bookings must not cross a UTC calendar-day boundary — if they did, endFrac
    // would wrap to a small value (e.g. 01:00) and silently pass the closeHour
    // check, and the day-of-week check on startTime alone would miss an endTime
    // that lands on a disallowed day (e.g. Friday→Saturday).
    if (
      startTime.getUTCFullYear() !== endTime.getUTCFullYear() ||
      startTime.getUTCMonth() !== endTime.getUTCMonth() ||
      startTime.getUTCDate() !== endTime.getUTCDate()
    ) {
      throw new BadRequestException(
        'Booking must start and end on the same calendar day (UTC)',
      );
    }

    const bookingDayNum = JS_UTC_TO_DAY_NUM[startTime.getUTCDay()];
    if (bookingDayNum < DAY_NUM[daysFrom] || bookingDayNum > DAY_NUM[daysTo]) {
      throw new BadRequestException(
        `Booking day is outside available days (${daysFrom}–${daysTo})`,
      );
    }

    const startFrac = startTime.getUTCHours() + startTime.getUTCMinutes() / 60;
    const endFrac = endTime.getUTCHours() + endTime.getUTCMinutes() / 60;

    if (startFrac < openHour || endFrac > closeHour) {
      throw new BadRequestException(
        `Booking time is outside open hours (${openHour}:00–${closeHour}:00 UTC)`,
      );
    }
  }

  private async checkNoOverlap(
    locationId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const active = await this.bookingRepo.find({
      where: {
        locationId,
        status: BookingStatus.Active,
        startTime: LessThan(endTime),
        endTime: MoreThan(startTime),
      },
    });

    const conflict = active.find((b) => b.id !== excludeBookingId);

    if (conflict) {
      throw new BadRequestException(
        'This time slot overlaps with an existing booking',
      );
    }
  }
}
