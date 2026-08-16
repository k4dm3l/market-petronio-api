import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { Role } from '../common/enums/role.enum';
import { AdminService } from './admin.service';
import { SetActiveDto } from './dto/set-active.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Basic dashboard stats (cooks, customers, products, orders, sales)',
  })
  stats() {
    return this.adminService.getStats();
  }

  @Get('customers')
  @ApiOperation({
    summary: 'List customers',
    description: 'Optional `search` matches name or email (case-insensitive).',
  })
  listCustomers(@Query() query: SearchQueryDto) {
    return this.adminService.listCustomers(query.search);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Activate / deactivate a customer' })
  setCustomerActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.adminService.setCustomerActive(id, dto.isActive);
  }

  @Get('cooks')
  @ApiOperation({
    summary: 'List all cooks (including inactive)',
    description:
      'Optional `search` matches display name, bio, location, specialties, WhatsApp, or linked user name/email.',
  })
  listCooks(@Query() query: SearchQueryDto) {
    return this.adminService.listCooks(query.search);
  }

  @Patch('cooks/:id')
  @ApiOperation({ summary: 'Activate / deactivate a cook' })
  setCookActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.adminService.setCookActive(id, dto.isActive);
  }

  @Get('products')
  @ApiOperation({ summary: 'Review all products (including inactive)' })
  listProducts() {
    return this.adminService.listProducts();
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Activate / deactivate a product' })
  setProductActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.adminService.setProductActive(id, dto.isActive);
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Review all orders',
    description:
      'Optional `search` matches order number, status, payment method, or customer name/email.',
  })
  listOrders(@Query() query: SearchQueryDto) {
    return this.adminService.listOrders(query.search);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'List all categories (including inactive)',
    description: 'Optional `search` matches name or description.',
  })
  listCategories(@Query() query: SearchQueryDto) {
    return this.adminService.listCategories(query.search);
  }
}
