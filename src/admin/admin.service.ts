import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { CooksService } from '../cooks/cooks.service';
import { Role } from '../common/enums/role.enum';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly cooksService: CooksService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async getStats() {
    const [
      activeCooks,
      registeredCustomers,
      products,
      orders,
      processedSales,
      categories,
    ] = await Promise.all([
      this.cooksService.countActive(),
      this.usersService.countByRole(Role.Customer),
      this.productsService.countAll(),
      this.ordersService.countAll(),
      this.ordersService.sumProcessedSales(),
      this.categoriesService.findAll(true).then((c) => c.length),
    ]);

    return {
      activeCooks,
      registeredCustomers,
      products,
      orders,
      categories,
      processedSales,
    };
  }

  async listCustomers() {
    const users = await this.usersService.listByRole(Role.Customer);
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: (u as { createdAt?: Date }).createdAt,
    }));
  }

  async setCustomerActive(userId: string, isActive: boolean) {
    const user = await this.usersService.findById(userId);
    if (!user || user.role !== Role.Customer) {
      throw new NotFoundException('Customer not found');
    }
    const updated = await this.usersService.setActive(userId, isActive);
    return {
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      role: updated!.role,
      isActive: updated!.isActive,
    };
  }

  listCooks() {
    return this.cooksService.listAllForAdmin();
  }

  setCookActive(cookId: string, isActive: boolean) {
    return this.cooksService.setActive(cookId, isActive);
  }

  listProducts() {
    return this.productsService.listAllForAdmin();
  }

  setProductActive(productId: string, isActive: boolean) {
    return this.productsService.setActive(productId, isActive);
  }

  listOrders() {
    return this.ordersService.listAllForAdmin();
  }

  listCategories() {
    return this.categoriesService.findAll(true);
  }
}
