import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module';
import { BookingValidatorService } from './booking-validator.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), LocationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingValidatorService],
})
export class BookingsModule {}
