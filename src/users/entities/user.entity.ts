import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';

@Entity('users')
export class User {
  @ApiProperty({ example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'john.doe' })
  @Column({ unique: true, length: 100 })
  username!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 255, select: false })
  password!: string;

  @ApiProperty({ example: 'EFM' })
  @Column({ length: 50 })
  department!: string;

  @ApiProperty({ enum: Role, example: Role.User })
  @Column({ type: 'enum', enum: Role, default: Role.User })
  role!: Role;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
