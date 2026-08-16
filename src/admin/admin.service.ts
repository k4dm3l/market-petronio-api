import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { CooksService } from '../cooks/cooks.service';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly notificationsService: NotificationsService,
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
      this.categoriesService.countAll(true),
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

  async listCustomers(query: SearchQueryDto = {}) {
    const page = await this.usersService.listByRole(Role.Customer, query);
    return {
      data: page.data.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: (u as { createdAt?: Date }).createdAt,
      })),
      pagination: page.pagination,
    };
  }

  async setCustomerActive(userId: string, isActive: boolean) {
    const user = await this.usersService.findById(userId);
    if (!user || user.role !== Role.Customer) {
      throw new NotFoundException('Customer not found');
    }
    const updated = await this.usersService.setActive(userId, isActive);

    await this.notificationsService
      .notifyUserStatusUpdated({
        userId: updated!.id,
        email: updated!.email,
        userName: updated!.name,
        isActive,
      })
      .catch(() => undefined);

    return {
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      role: updated!.role,
      isActive: updated!.isActive,
    };
  }

  listCooks(query: SearchQueryDto = {}) {
    return this.cooksService.listAllForAdmin(query);
  }

  async setCookActive(cookId: string, isActive: boolean) {
    const cook = await this.cooksService.setActive(cookId, isActive);
    const cookUser = await this.usersService.findById(cook.userId);
    if (cookUser) {
      await this.notificationsService
        .notifyUserStatusUpdated({
          userId: cookUser.id,
          email: cookUser.email,
          userName: cookUser.name,
          isActive,
        })
        .catch(() => undefined);
    }
    return cook;
  }

  listProducts(query: CursorPaginationQueryDto = {}) {
    return this.productsService.listAllForAdmin(query);
  }

  async setProductActive(productId: string, isActive: boolean) {
    const product = await this.productsService.setActive(productId, isActive);
    const cook = await this.cooksService.getById(String(product.cookId));
    if (cook) {
      const cookUser = await this.usersService.findById(cook.userId.toString());
      if (cookUser) {
        await this.notificationsService
          .notifyProductStatusUpdated({
            cookUserId: cookUser.id,
            cookEmail: cookUser.email,
            productId: String(product.id),
            productName: String(product.name),
            isActive,
          })
          .catch(() => undefined);
      }
    }
    return product;
  }

  listOrders(query: SearchQueryDto = {}) {
    return this.ordersService.listAllForAdmin(query);
  }

  listCategories(query: SearchQueryDto = {}) {
    return this.categoriesService.findAll(true, query);
  }
}
