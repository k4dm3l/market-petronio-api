import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateOrderDto,
  CustomerOrdersListResponseDto,
  DeliverySource,
  ListOrdersQueryDto,
  OrderResponseDto,
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
    summary: 'Create order with delivery snapshot',
    description: `
Single-cook order. Stock is reserved for \`available\` products.

**Delivery (required)** — copied onto the order at create time (profile changes later do not affect this order):

- \`source: CUSTOMER_PROFILE\` — primary saved address (or \`addressId\`); falls back to legacy deliveryInformation
- \`source: CUSTOM\` — requires \`location\` (GeoJSON Point \`[lng, lat]\`) and \`address\`; \`additionalInformation\` optional
    `.trim(),
  })
  @ApiBody({
    type: CreateOrderDto,
    examples: {
      customerProfile: {
        summary: 'Use primary saved address',
        value: {
          cookId: '507f1f77bcf86cd799439011',
          items: [{ productId: '507f1f77bcf86cd799439012', quantity: 2 }],
          delivery: { source: DeliverySource.CustomerProfile },
          paymentMethod: 'nequi',
        },
      },
      savedAddress: {
        summary: 'Use a specific saved address',
        value: {
          cookId: '507f1f77bcf86cd799439011',
          items: [{ productId: '507f1f77bcf86cd799439012', quantity: 2 }],
          delivery: {
            source: DeliverySource.CustomerProfile,
            addressId: '01K2ABC...',
          },
          paymentMethod: 'nequi',
        },
      },
      customDelivery: {
        summary: 'Custom address for this order',
        value: {
          cookId: '507f1f77bcf86cd799439011',
          items: [{ productId: '507f1f77bcf86cd799439012', quantity: 2 }],
          delivery: {
            source: DeliverySource.Custom,
            location: {
              type: 'Point',
              coordinates: [-77.0319, 3.8833],
            },
            address: 'Calle 5 #10-20',
            additionalInformation: 'Casa azul, next to the bakery',
          },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Created order including delivery snapshot',
    type: OrderResponseDto,
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user, dto);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Get()
  @ApiOperation({
    summary: 'List orders for the authenticated user',
    description: `
**Customers (spec 003)** — order history scoped to the JWT user id (never pass \`customerId\`).
Supports cursor pagination: \`?limit=20&cursor=...\` (default 20, max 100).
Optional \`status\` filters by exact order status. Optional \`search\` matches order number / payment method (admins also match customer name/email).

Response for customers:
\`{ data: [{ id, status, paymentStatus, total, createdAt }], pagination: { nextCursor, hasMore } }\`

**Cooks / admins** — same pagination shape; cooks only see orders for their cook profile (full order objects in \`data\`).
    `.trim(),
  })
  @ApiOkResponse({
    description: 'Paginated order list',
    type: CustomerOrdersListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.findAll(user, query);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Get(':id')
  @ApiOperation({ summary: 'Get order by id' })
  @ApiOkResponse({ type: OrderResponseDto })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.findOne(id, user);
  }

  @Roles(Role.Customer, Role.Cook, Role.Admin)
  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Advance order status (cook/admin) or cancel PENDING/CONFIRMED (customer/cook/admin)',
    description:
      'To cancel, send `{ "status": "CANCELLED", "reason": "..." }` (reason 5–500 chars). Payment status is not changed. Stock is released if it was reserved.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
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
  @ApiOkResponse({ type: OrderResponseDto })
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
  @ApiOkResponse({ type: OrderResponseDto })
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
  @ApiOkResponse({ type: OrderResponseDto })
  confirmReception(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.confirmReception(id, user);
  }
}
