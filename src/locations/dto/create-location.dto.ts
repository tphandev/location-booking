import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DayOfWeek } from '../../common/interfaces/open-time.interface';

export class OpenTimeScheduledDto {
  type: 'scheduled';
  daysFrom: DayOfWeek;
  daysTo: DayOfWeek;
  openHour: number;
  closeHour: number;
}

export class OpenTimeAlwaysDto {
  type: 'always';
}

export class CreateLocationDto {
  @ApiProperty({ example: 'BLD-A-01-001' })
  @IsString()
  @Length(1, 50)
  locationNumber: string;

  @ApiProperty({ example: 'Meeting Room Alpha' })
  @IsString()
  @Length(1, 200)
  locationName: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @Length(1, 10)
  building: string;

  @ApiPropertyOptional({ description: 'Parent location UUID', example: null })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ example: 'EFM' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Opening schedule',
    example: {
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    },
  })
  @IsObject()
  @IsOptional()
  openTime?: OpenTimeScheduledDto | OpenTimeAlwaysDto;
}
