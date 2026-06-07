import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List locations (paginated, optional building filter)',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of locations' })
  findAll(@Query() query: LocationQueryDto) {
    return this.locationsService.findAll(query);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Full nested location tree' })
  @ApiResponse({
    status: 200,
    description: 'Hierarchical tree of all locations',
  })
  findTree() {
    return this.locationsService.findTree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single location with its direct children' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Location found' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: '[Admin] Create a new location' })
  @ApiResponse({ status: 201, description: 'Location created' })
  @ApiResponse({
    status: 400,
    description: 'Location number already exists or invalid parent',
  })
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: '[Admin] Update a location' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Location updated' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Soft-delete a location and all its descendants',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Location and descendants deleted' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.remove(id);
  }
}
