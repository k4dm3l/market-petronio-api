import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UpsertDeliveryInformationDto } from './dto/delivery-information.dto';
import { UserMeResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Includes `deliveryInformation` (location GeoJSON Point, address, optional notes) when set.',
  })
  @ApiOkResponse({ type: UserMeResponseDto })
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  @Roles(Role.Customer)
  @Patch('me/delivery-information')
  @ApiOperation({
    summary: 'Set or replace default delivery information',
    description:
      'Single default address for MVP. Used when creating orders with `delivery.source = CUSTOMER_PROFILE`.',
  })
  @ApiOkResponse({ type: UserMeResponseDto })
  upsertDelivery(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertDeliveryInformationDto,
  ) {
    return this.usersService.upsertDeliveryInformation(user.id, dto);
  }
}
