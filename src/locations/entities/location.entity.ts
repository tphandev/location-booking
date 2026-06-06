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
import { OpenTime } from '../../common/interfaces/open-time.interface';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50, name: 'location_number' })
  locationNumber!: string;

  @Column({ length: 200, name: 'location_name' })
  locationName!: string;

  @Column({ length: 10 })
  building!: string;

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

  @Column({ nullable: true, type: 'varchar', length: 50 })
  department!: string | null;

  @Column({ nullable: true, type: 'int' })
  capacity!: number | null;

  @Column({ nullable: true, type: 'jsonb', name: 'open_time' })
  openTime!: OpenTime | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  get isBookable(): boolean {
    return (
      this.department !== null &&
      this.capacity !== null &&
      this.openTime !== null
    );
  }
}
