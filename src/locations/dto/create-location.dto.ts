import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { DayOfWeek } from '../../common/interfaces/open-time.interface';

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

export class OpenTimeScheduledDto {
  @IsIn(['scheduled'])
  type: 'scheduled';

  @IsIn(DAYS_OF_WEEK)
  daysFrom: DayOfWeek;

  @IsIn(DAYS_OF_WEEK)
  daysTo: DayOfWeek;

  @IsInt()
  @Min(0)
  @Max(23)
  openHour: number;

  @IsInt()
  @Min(0)
  @Max(23)
  closeHour: number;
}

export class OpenTimeAlwaysDto {
  @IsIn(['always'])
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
  @IsOptional()
  @ValidateNested()
  @Type(() => Object, {
    discriminator: {
      property: 'type',
      subTypes: [
        { value: OpenTimeScheduledDto, name: 'scheduled' },
        { value: OpenTimeAlwaysDto, name: 'always' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  openTime?: OpenTimeScheduledDto | OpenTimeAlwaysDto;
}
