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
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Location } from '../../locations/entities/location.entity';
import { User } from '../../users/entities/user.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'location_id' })
  locationId!: string;

  @ManyToOne(() => Location, { eager: false })
  @JoinColumn({ name: 'location_id' })
  location!: Location;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'int' })
  attendees!: number;

  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'timestamptz', name: 'end_time' })
  endTime!: Date;

  @Column({ nullable: true, type: 'varchar', length: 200 })
  title!: string | null;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.Active })
  status!: BookingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
