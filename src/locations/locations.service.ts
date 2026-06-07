import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
  ) {}

  async findAll(query: LocationQueryDto): Promise<{
    data: Location[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.locationRepo
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.parent', 'parent')
      .where('location.deletedAt IS NULL')
      .orderBy('location.building', 'ASC')
      .addOrderBy('location.locationNumber', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.building) {
      qb.andWhere('location.building = :building', {
        building: query.building,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findTree(): Promise<Location[]> {
    const all = await this.locationRepo.find({
      where: { deletedAt: IsNull() },
      order: { locationNumber: 'ASC' },
    });

    const map = new Map<string, Location>();
    const roots: Location[] = [];

    for (const loc of all) {
      loc.children = [];
      map.set(loc.id, loc);
    }

    for (const loc of all) {
      if (loc.parentId && map.has(loc.parentId)) {
        map.get(loc.parentId)!.children.push(loc);
      } else {
        roots.push(loc);
      }
    }

    return roots;
  }

  async findOne(id: string): Promise<Location> {
    const location = await this.locationRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['parent', 'children'],
    });

    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }

    return location;
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    const existing = await this.locationRepo.findOne({
      where: { locationNumber: dto.locationNumber },
    });
    if (existing) {
      throw new BadRequestException(
        `Location number "${dto.locationNumber}" already exists`,
      );
    }

    if (dto.parentId) {
      const parent = await this.locationRepo.findOne({
        where: { id: dto.parentId, deletedAt: IsNull() },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent location ${dto.parentId} not found`,
        );
      }
    }

    const location = this.locationRepo.create({
      locationNumber: dto.locationNumber,
      locationName: dto.locationName,
      building: dto.building,
      parentId: dto.parentId ?? null,
      department: dto.department ?? null,
      capacity: dto.capacity ?? null,
      openTime: dto.openTime ?? null,
    });

    return this.locationRepo.save(location);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.findOne(id);

    if (dto.locationNumber && dto.locationNumber !== location.locationNumber) {
      const conflict = await this.locationRepo.findOne({
        where: { locationNumber: dto.locationNumber },
      });
      if (conflict) {
        throw new BadRequestException(
          `Location number "${dto.locationNumber}" already exists`,
        );
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A location cannot be its own parent');
      }
      if (dto.parentId) {
        const parent = await this.locationRepo.findOne({
          where: { id: dto.parentId, deletedAt: IsNull() },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent location ${dto.parentId} not found`,
          );
        }
      }
    }

    Object.assign(location, {
      ...(dto.locationNumber !== undefined && {
        locationNumber: dto.locationNumber,
      }),
      ...(dto.locationName !== undefined && { locationName: dto.locationName }),
      ...(dto.building !== undefined && { building: dto.building }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
      ...(dto.department !== undefined && {
        department: dto.department ?? null,
      }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity ?? null }),
      ...(dto.openTime !== undefined && { openTime: dto.openTime ?? null }),
    });

    return this.locationRepo.save(location);
  }

  async remove(id: string): Promise<void> {
    const location = await this.findOne(id);

    const descendants = await this.collectDescendants(id);
    const allIds = [id, ...descendants];

    await this.locationRepo
      .createQueryBuilder()
      .update(Location)
      .set({ deletedAt: new Date() })
      .whereInIds(allIds)
      .execute();

    void location;
  }

  private async collectDescendants(parentId: string): Promise<string[]> {
    const children = await this.locationRepo.find({
      where: { parentId, deletedAt: IsNull() },
      select: ['id'],
    });

    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const nested = await this.collectDescendants(child.id);
      ids.push(...nested);
    }
    return ids;
  }
}
