import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
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
  @ApiOperation({ summary: 'List customers' })
  listCustomers() {
    return this.adminService.listCustomers();
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Activate / deactivate a customer' })
  setCustomerActive(@Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.adminService.setCustomerActive(id, dto.isActive);
  }

  @Get('cooks')
  @ApiOperation({ summary: 'List all cooks (including inactive)' })
  listCooks() {
    return this.adminService.listCooks();
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
  @ApiOperation({ summary: 'Review all orders' })
  listOrders() {
    return this.adminService.listOrders();
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories (including inactive)' })
  listCategories() {
    return this.adminService.listCategories();
  }
}
