import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { UsersModule } from '../users/users.module';
import { CooksController } from './cooks.controller';
import { CooksService } from './cooks.service';
import { Cook, CookSchema } from './schemas/cook.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cook.name, schema: CookSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    UsersModule,
  ],
  controllers: [CooksController],
  providers: [CooksService],
  exports: [CooksService],
})
export class CooksModule {}
