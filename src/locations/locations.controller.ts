import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AddressDetailsResponseDto } from './dto/address-details.dto';
import {
  LocationSearchResponseDto,
  SearchAddressQueryDto,
} from './dto/search-address.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@ApiBearerAuth()
@Roles(Role.Customer, Role.Cook, Role.Admin)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('search')
  @ApiOperation({
    summary: 'Autocomplete address search',
    description:
      'Looks up Redis first (`cache:locations:search:*`). On miss, calls Places Autocomplete with a backend-managed Google session token (not the JWT). Debounce on the client (300–500ms). Optional `latitude`+`longitude` bias.',
  })
  @ApiOkResponse({ type: LocationSearchResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async search(
    @Query() query: SearchAddressQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.locationsService.search(query, user.id);
    return { data };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('places/:placeId')
  @ApiOperation({
    summary: 'Get normalized address details for a selected place',
    description:
      'Redis cache first. On miss, Place Details (New) with the backend Google session token, then cache. Maps to UserAddress fields.',
  })
  @ApiParam({ name: 'placeId', example: 'ChIJx...' })
  @ApiOkResponse({ type: AddressDetailsResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  getPlace(
    @Param('placeId') placeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.locationsService.getPlace(placeId, user.id);
  }
}
