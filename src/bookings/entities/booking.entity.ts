import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Location } from '../../locations/entities/location.entity';
import { User } from '../../users/entities/user.entity';

@Entity('bookings')
export class Booking {
  @ApiProperty({ example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'uuid-of-location' })
  @Column({ name: 'location_id' })
  locationId!: string;

  @ManyToOne(() => Location, { eager: false })
  @JoinColumn({ name: 'location_id' })
  location!: Location;

  @ApiProperty({ example: 'uuid-of-user' })
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ApiProperty({ example: 5 })
  @Column({ type: 'int' })
  attendees!: number;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime!: Date;

  @ApiProperty({ example: '2026-06-09T12:00:00.000Z' })
  @Column({ type: 'timestamptz', name: 'end_time' })
  endTime!: Date;

  @ApiPropertyOptional({ nullable: true, example: 'Team planning session' })
  @Column({ nullable: true, type: 'varchar', length: 200 })
  title!: string | null;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.Active })
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.Active })
  status!: BookingStatus;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
