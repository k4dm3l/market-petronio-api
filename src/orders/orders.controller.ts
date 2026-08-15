import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  UpdatePaymentDto,
  UpdateShippingDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.Customer)
  @Post()
  @ApiOperation({
    summary: 'Create order for a single cook (reserves stock when available)',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Get()
  @ApiOperation({ summary: 'List orders visible to the current user' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.ordersService.findAll(user);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Get(':id')
  @ApiOperation({ summary: 'Get order by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOne(id, user);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Advance order status (cook/admin) or cancel PENDING/CONFIRMED (customer/cook/admin)',
  })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user, dto);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Patch(':id/payment')
  @ApiOperation({
    summary:
      'Update payment (customer reports paid; cook marks PAID)',
  })
  updatePayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.ordersService.updatePayment(id, user, dto);
  }

  @Roles(Role.Cook, Role.Admin)
  @Patch(':id/shipping')
  @ApiOperation({ summary: 'Update shipping status / tracking (cook/admin)' })
  updateShipping(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateShippingDto,
  ) {
    return this.ordersService.updateShipping(id, user, dto);
  }

  @Roles(Role.Customer)
  @Post(':id/confirm-reception')
  @ApiOperation({ summary: 'Customer confirms order reception' })
  confirmReception(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.confirmReception(id, user);
  }
}
