import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpenTime } from '../../common/interfaces/open-time.interface';

@Entity('locations')
export class Location {
  @ApiProperty({ example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'BLD-A-01-001' })
  @Column({ unique: true, length: 50, name: 'location_number' })
  locationNumber!: string;

  @ApiProperty({ example: 'Meeting Room Alpha' })
  @Column({ length: 200, name: 'location_name' })
  locationName!: string;

  @ApiProperty({ example: 'A' })
  @Column({ length: 10 })
  building!: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  @Column({ nullable: true, type: 'uuid', name: 'parent_id' })
  parentId!: string | null;

  @ManyToOne(() => Location, (location) => location.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: Location | null;

  @OneToMany(() => Location, (location) => location.parent)
  children!: Location[];

  @ApiPropertyOptional({ nullable: true, example: 'EFM' })
  @Column({ nullable: true, type: 'varchar', length: 50 })
  department!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 10 })
  @Column({ nullable: true, type: 'int' })
  capacity!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    },
  })
  @Column({ nullable: true, type: 'jsonb', name: 'open_time' })
  openTime!: OpenTime | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @ApiProperty({
    description: 'True when department, capacity and openTime are all set',
  })
  get isBookable(): boolean {
    return (
      this.department !== null &&
      this.capacity !== null &&
      this.openTime !== null
    );
  }
}
