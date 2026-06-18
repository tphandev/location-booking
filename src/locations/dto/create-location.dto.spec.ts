import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLocationDto } from './create-location.dto';

async function validateOpenTime(openTime: unknown) {
  const dto = plainToInstance(CreateLocationDto, {
    locationNumber: 'BLD-A-01-001',
    locationName: 'Room',
    building: 'A',
    openTime,
  });
  return validate(dto);
}

describe('CreateLocationDto openTime validation', () => {
  it('rejects out-of-range hours', async () => {
    const errors = await validateOpenTime({
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 99,
      closeHour: -1,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid day strings', async () => {
    const errors = await validateOpenTime({
      type: 'scheduled',
      daysFrom: 'Whenever',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown discriminator type', async () => {
    const errors = await validateOpenTime({ type: 'bogus' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a valid scheduled shape', async () => {
    const errors = await validateOpenTime({
      type: 'scheduled',
      daysFrom: 'Mon',
      daysTo: 'Fri',
      openHour: 9,
      closeHour: 18,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid always shape', async () => {
    const errors = await validateOpenTime({ type: 'always' });
    expect(errors).toHaveLength(0);
  });

  it('allows openTime to be omitted', async () => {
    const errors = await validateOpenTime(undefined);
    expect(errors).toHaveLength(0);
  });
});
