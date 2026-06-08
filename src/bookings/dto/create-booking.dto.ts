import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-of-location' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  attendees: number;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({ example: '2026-06-09T12:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @ApiPropertyOptional({ example: 'Team planning session', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;
}
