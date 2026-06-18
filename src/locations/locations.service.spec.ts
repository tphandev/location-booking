import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Location } from './entities/location.entity';
import { LocationsService } from './locations.service';

describe('LocationsService.update circular reference checks', () => {
  let service: LocationsService;
  let repo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: getRepositoryToken(Location), useValue: repo },
      ],
    }).compile();
    service = module.get(LocationsService);
  });

  it('rejects a location being its own parent', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'A', locationNumber: 'A' });

    await expect(service.update('A', { parentId: 'A' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects moving a location under its own descendant', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 'A', locationNumber: 'A' }) // this.findOne(id)
      .mockResolvedValueOnce({ id: 'B' }); // parent existence check
    repo.find
      .mockResolvedValueOnce([{ id: 'B' }]) // collectDescendants('A') children
      .mockResolvedValueOnce([]); // collectDescendants('B') children

    await expect(service.update('A', { parentId: 'B' })).rejects.toThrow(
      'Cannot move a location under one of its own descendants',
    );
  });

  it('allows a valid non-cyclic parent reassignment', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 'A', locationNumber: 'A' })
      .mockResolvedValueOnce({ id: 'C' });
    repo.find.mockResolvedValue([]); // no descendants
    repo.save.mockResolvedValueOnce({ id: 'A', parentId: 'C' });

    await expect(service.update('A', { parentId: 'C' })).resolves.toBeDefined();
  });
});
