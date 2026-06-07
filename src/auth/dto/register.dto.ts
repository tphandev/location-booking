import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'john.doe' })
  @IsString()
  @Length(3, 100)
  username: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'EFM',
    description: 'Department code e.g. EFM, FSS, AVS, ASS',
  })
  @IsString()
  department: string;

  @ApiPropertyOptional({ enum: Role, default: Role.User })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
