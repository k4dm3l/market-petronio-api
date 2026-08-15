import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { CooksModule } from '../cooks/cooks.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    UsersModule,
    CooksModule,
    ProductsModule,
    OrdersModule,
    CategoriesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
