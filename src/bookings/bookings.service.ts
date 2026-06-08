import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Role } from '../common/enums/role.enum';
import { BookingValidatorService } from './booking-validator.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly validator: BookingValidatorService,
  ) {}

  async findAll(
    user: JwtPayload,
    query: BookingQueryDto,
  ): Promise<{
    data: Booking[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: FindOptionsWhere<Booking> = {};

    if (user.role !== Role.Admin) {
      where.userId = user.sub;
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.bookingRepo.findAndCount({
      where,
      order: { startTime: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findOne(id: string, user: JwtPayload): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({ where: { id } });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    if (user.role !== Role.Admin && booking.userId !== user.sub) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return booking;
  }

  async create(user: JwtPayload, dto: CreateBookingDto): Promise<Booking> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    await this.validator.validate(
      dto.locationId,
      dto.attendees,
      dto.startTime,
      dto.endTime,
      user.department,
    );

    const booking = this.bookingRepo.create({
      locationId: dto.locationId,
      userId: user.sub,
      attendees: dto.attendees,
      startTime: dto.startTime,
      endTime: dto.endTime,
      title: dto.title ?? null,
      status: BookingStatus.Active,
    });

    return this.saveOrConflict(booking);
  }

  async update(
    id: string,
    user: JwtPayload,
    dto: UpdateBookingDto,
  ): Promise<Booking> {
    const booking = await this.findOne(id, user);

    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Cannot update a cancelled booking');
    }

    const newStart = dto.startTime ?? booking.startTime;
    const newEnd = dto.endTime ?? booking.endTime;
    const newAttendees = dto.attendees ?? booking.attendees;

    if (newStart >= newEnd) {
      throw new BadRequestException('startTime must be before endTime');
    }

    await this.validator.validate(
      booking.locationId,
      newAttendees,
      newStart,
      newEnd,
      user.department,
      id,
    );

    Object.assign(booking, {
      ...(dto.attendees !== undefined && { attendees: dto.attendees }),
      ...(dto.startTime !== undefined && { startTime: dto.startTime }),
      ...(dto.endTime !== undefined && { endTime: dto.endTime }),
      ...(dto.title !== undefined && { title: dto.title }),
    });

    return this.saveOrConflict(booking);
  }

  async remove(id: string, user: JwtPayload): Promise<void> {
    const booking = await this.findOne(id, user);
    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Booking is already cancelled');
    }
    // Single UPDATE sets both status and deletedAt atomically, eliminating the
    // crash window that existed between the previous two-save approach.
    await this.bookingRepo.update(id, {
      status: BookingStatus.Cancelled,
      deletedAt: new Date(),
    });
  }

  // Converts a PostgreSQL exclusion-constraint violation (23P01) into a
  // ConflictException. This only fires for concurrent requests that both
  // passed the app-level overlap check — the DB constraint is the safety net.
  private async saveOrConflict(booking: Booking): Promise<Booking> {
    try {
      return await this.bookingRepo.save(booking);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code === '23P01'
      ) {
        throw new ConflictException('This time slot is already booked');
      }
      throw err;
    }
  }
}
