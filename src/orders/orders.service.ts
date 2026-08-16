import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CooksService } from '../cooks/cooks.service';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { emptyPage } from '../common/pagination/paginated-response';
import {
  applyCreatedAtIdCursor,
  createdAtIdPayload,
  paginateSlice,
  resolveLimit,
} from '../common/pagination/cursor.util';
import { escapeRegex } from '../common/utils/escape-regex';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ProductAvailability,
  ProductDocument,
} from '../products/schemas/product.schema';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import {
  CreateOrderDto,
  DeliverySource,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
  UpdatePaymentDto,
  UpdateShippingDto,
} from './dto/order.dto';
import {
  Order,
  OrderDelivery,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from './schemas/order.schema';

const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.Pending,
  OrderStatus.Confirmed,
  OrderStatus.Preparing,
  OrderStatus.ReadyToShip,
  OrderStatus.Shipped,
  OrderStatus.Delivered,
];

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
    private readonly cooksService: CooksService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(actor: AuthUser, dto: CreateOrderDto) {
    if (actor.role !== Role.Customer && actor.role !== Role.Admin) {
      throw new ForbiddenException('Only customers can create orders');
    }

    const delivery = await this.resolveDeliverySnapshot(actor.id, dto);
    const cook = await this.cooksService.getById(dto.cookId);
    if (!cook || !cook.isActive) {
      throw new NotFoundException('Cook not found');
    }

    const customerId = actor.id;

    const lineItems: {
      product: ProductDocument;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];

    for (const item of dto.items) {
      const product = await this.productsService.getById(item.productId);
      if (!product || !product.isActive || !product.isAvailable) {
        throw new BadRequestException(`Product unavailable: ${item.productId}`);
      }
      if (product.cookId.toString() !== dto.cookId) {
        throw new BadRequestException(
          'All products must belong to the same cook',
        );
      }
      if (
        product.availability === ProductAvailability.MadeToOrder &&
        item.quantity < product.minimumOrderQuantity
      ) {
        throw new BadRequestException(
          `Minimum order for ${product.name} is ${product.minimumOrderQuantity}`,
        );
      }
      lineItems.push({
        product,
        quantity: item.quantity,
        unitPrice: product.price,
        total: product.price * item.quantity,
      });
    }

    const reserved: { productId: string; quantity: number }[] = [];
    try {
      for (const line of lineItems) {
        if (line.product.availability === ProductAvailability.Available) {
          await this.productsService.reserveStock(
            line.product.id,
            line.quantity,
          );
          reserved.push({
            productId: line.product.id,
            quantity: line.quantity,
          });
        }
      }
    } catch (err) {
      await this.rollbackReservations(reserved);
      throw err;
    }

    const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0);
    const shipping = dto.shippingCost ?? 0;
    const orderNumber = await this.nextOrderNumber();

    const order = await this.orderModel.create({
      orderNumber,
      customerId: new Types.ObjectId(customerId),
      cookId: cook._id,
      items: lineItems.map((l) => ({
        productId: l.product._id,
        name: l.product.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.total,
      })),
      totals: { subtotal, shipping, total: subtotal + shipping },
      delivery,
      payment: {
        status: PaymentStatus.Pending,
        method: dto.paymentMethod,
        customerReportedPaid: false,
      },
      shipping: { status: ShippingStatus.Pending },
      status: OrderStatus.Pending,
      customerConfirmation: { confirmed: false },
      stockReserved: reserved.length > 0,
    });

    await this.emitOrderCreated(order, cook.displayName);

    return this.toResponse(order);
  }

  /** Spec 005 — resolve + snapshot delivery before products/inventory. */
  private async resolveDeliverySnapshot(
    customerId: string,
    dto: CreateOrderDto,
  ): Promise<OrderDelivery> {
    if (dto.delivery.source === DeliverySource.CustomerProfile) {
      const user = await this.usersService.findById(customerId);
      if (!user) throw new NotFoundException('User not found');

      const snapshot = this.usersService.getDeliverySnapshot(user);
      if (!snapshot) {
        throw new BadRequestException(
          'No saved delivery information. Set it on your profile or use delivery.source=CUSTOM with location and address.',
        );
      }
      return snapshot;
    }

    // CUSTOM
    if (!dto.delivery.location || !dto.delivery.address?.trim()) {
      throw new BadRequestException(
        'delivery.location and delivery.address are required when source is CUSTOM',
      );
    }

    const [lng, lat] = dto.delivery.location.coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new BadRequestException(
        'coordinates must be [longitude (-180..180), latitude (-90..90)]',
      );
    }

    return {
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      address: dto.delivery.address.trim(),
      additionalInformation:
        dto.delivery.additionalInformation?.trim() || undefined,
    };
  }

  async findAll(actor: AuthUser, query: ListOrdersQueryDto = {}) {
    // Spec 003: customers only see their own history (JWT id, never pass customerId)
    if (actor.role === Role.Customer) {
      return this.listCustomerHistory(actor.id, query);
    }

    const filter: Record<string, unknown> = {};
    if (actor.role === Role.Cook) {
      const cook = await this.cooksService.findByUserId(actor.id);
      if (!cook) {
        return emptyPage();
      }
      filter.cookId = cook._id;
    }

    if (query.status) {
      filter.status = query.status;
    }

    await this.applyOrderSearchFilter(filter, query.search, {
      includeCustomerName: actor.role === Role.Admin,
    });

    return this.listWithCursor(filter, query, (o) => this.toResponse(o));
  }

  /**
   * Spec 003 — customer order history with cursor pagination.
   * Scoped exclusively to authenticatedUser.id from the JWT.
   */
  async listCustomerHistory(customerId: string, query: ListOrdersQueryDto) {
    const filter: Record<string, unknown> = {
      customerId: new Types.ObjectId(customerId),
    };

    if (query.status) {
      filter.status = query.status;
    }

    await this.applyOrderSearchFilter(filter, query.search, {
      includeCustomerName: false,
    });

    return this.listWithCursor(filter, query, (o) => {
      const createdAt =
        (o as OrderDocument & { createdAt?: Date }).createdAt ?? new Date(0);
      return {
        id: o.id,
        status: o.status,
        paymentStatus: o.payment.status,
        total: o.totals.total,
        createdAt,
      };
    });
  }

  async listAllForAdmin(query: ListOrdersQueryDto = {}) {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    await this.applyOrderSearchFilter(filter, query.search, {
      includeCustomerName: true,
    });
    return this.listWithCursor(filter, query, (o) => this.toResponse(o));
  }

  /** Free-text search on order number / payment method / optional customer name. */
  private async applyOrderSearchFilter(
    filter: Record<string, unknown>,
    search: string | undefined,
    options: { includeCustomerName: boolean },
  ): Promise<void> {
    if (!search?.trim()) return;

    const trimmed = search.trim();
    const q = escapeRegex(trimmed);

    const or: Record<string, unknown>[] = [
      { orderNumber: { $regex: q, $options: 'i' } },
      { 'payment.method': { $regex: q, $options: 'i' } },
    ];

    if (options.includeCustomerName) {
      const customerIds = await this.usersService.findIdsMatchingSearch(
        trimmed,
        Role.Customer,
      );
      if (customerIds.length) {
        or.push({ customerId: { $in: customerIds } });
      }
    }

    filter.$and = [
      ...((filter.$and as Record<string, unknown>[]) ?? []),
      { $or: or },
    ];
  }

  private async listWithCursor<T>(
    baseFilter: Record<string, unknown>,
    query: ListOrdersQueryDto,
    mapItem: (order: OrderDocument) => T,
  ) {
    const limit = resolveLimit(query.limit);
    const filter: Record<string, unknown> = { ...baseFilter };
    applyCreatedAtIdCursor(filter, query.cursor);

    const rows = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    return paginateSlice(rows, limit, mapItem, (doc) =>
      createdAtIdPayload(doc as OrderDocument & { createdAt?: Date }),
    );
  }

  async countAll(): Promise<number> {
    return this.orderModel.countDocuments().exec();
  }

  async sumProcessedSales(): Promise<number> {
    const rows = await this.orderModel
      .aggregate<{ total: number }>([
        { $match: { 'payment.status': PaymentStatus.Paid } },
        {
          $group: {
            _id: null,
            total: { $sum: '$totals.total' },
          },
        },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  async findOne(id: string, actor: AuthUser) {
    const order = await this.findByIdOrThrow(id);
    await this.assertCanView(order, actor);
    return this.toResponse(order);
  }

  async updateStatus(
    id: string,
    actor: AuthUser,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findByIdOrThrow(id);

    if (dto.status === OrderStatus.Cancelled) {
      await this.assertCanView(order, actor);
      return this.cancelOrder(order, actor);
    }

    await this.assertCookOrAdmin(order, actor);

    this.assertForwardTransition(order.status, dto.status);
    this.assertPaymentBeforePrepare(order, dto.status);

    if (
      dto.status === OrderStatus.Confirmed &&
      order.status === OrderStatus.Pending
    ) {
      // Inventory already reserved on create; CONFIRMED commits it (spec §11).
      order.stockReserved = true;
    }

    if (
      dto.status === OrderStatus.Shipped &&
      order.shipping.status === ShippingStatus.Pending
    ) {
      order.shipping.status = ShippingStatus.Shipped;
      order.shipping.shippedAt = new Date();
    }

    if (dto.status === OrderStatus.Delivered) {
      order.shipping.status = ShippingStatus.Delivered;
      order.shipping.deliveredAt = new Date();
    }

    order.status = dto.status;
    await order.save();

    await this.emitOrderStatusUpdated(order);
    return this.toResponse(order);
  }

  async updatePayment(id: string, actor: AuthUser, dto: UpdatePaymentDto) {
    const order = await this.findByIdOrThrow(id);
    await this.assertCanView(order, actor);

    if (order.status === OrderStatus.Cancelled) {
      throw new BadRequestException('Order is cancelled');
    }

    const previousPaymentStatus = order.payment.status;

    if (actor.role === Role.Customer) {
      if (order.customerId.toString() !== actor.id) {
        throw new ForbiddenException();
      }
      if (dto.status === PaymentStatus.Paid) {
        throw new ForbiddenException('Only the cook can mark payment as PAID');
      }
      if (dto.customerReportedPaid !== undefined) {
        order.payment.customerReportedPaid = dto.customerReportedPaid;
      }
      if (dto.method !== undefined) order.payment.method = dto.method;
      if (
        dto.status === PaymentStatus.PaymentInstructions ||
        dto.status === PaymentStatus.Pending ||
        dto.status === PaymentStatus.Failed
      ) {
        order.payment.status = dto.status;
      }
    } else {
      await this.assertCookOrAdmin(order, actor);
      if (dto.status !== undefined) {
        order.payment.status = dto.status;
        if (dto.status === PaymentStatus.Paid) {
          order.payment.paidAt = new Date();
        }
      }
      if (dto.method !== undefined) order.payment.method = dto.method;
      if (dto.customerReportedPaid !== undefined) {
        order.payment.customerReportedPaid = dto.customerReportedPaid;
      }
    }

    await order.save();

    if (
      dto.status !== undefined &&
      order.payment.status !== previousPaymentStatus
    ) {
      await this.emitPaymentStatusUpdated(order);
    }

    return this.toResponse(order);
  }

  async updateShipping(
    id: string,
    actor: AuthUser,
    dto: UpdateShippingDto,
  ) {
    const order = await this.findByIdOrThrow(id);
    await this.assertCookOrAdmin(order, actor);

    if (
      dto.status !== ShippingStatus.Pending &&
      order.payment.status !== PaymentStatus.Paid
    ) {
      throw new BadRequestException(
        'Payment must be PAID before updating shipping (spec: pay then prepare/ship)',
      );
    }

    const previousShippingStatus = order.shipping.status;

    order.shipping.status = dto.status;
    if (dto.carrier !== undefined) order.shipping.carrier = dto.carrier;
    if (dto.trackingNumber !== undefined) {
      order.shipping.trackingNumber = dto.trackingNumber;
    }
    if (
      dto.status === ShippingStatus.Shipped ||
      dto.status === ShippingStatus.InTransit
    ) {
      order.shipping.shippedAt = order.shipping.shippedAt ?? new Date();
      if (
        order.status === OrderStatus.Preparing ||
        order.status === OrderStatus.ReadyToShip ||
        order.status === OrderStatus.Confirmed
      ) {
        order.status = OrderStatus.Shipped;
      }
    }
    if (dto.status === ShippingStatus.Delivered) {
      order.shipping.deliveredAt = new Date();
      order.status = OrderStatus.Delivered;
    }

    await order.save();

    if (order.shipping.status !== previousShippingStatus) {
      await this.emitShippingStatusUpdated(order);
    }

    return this.toResponse(order);
  }

  async confirmReception(id: string, actor: AuthUser) {
    if (actor.role !== Role.Customer) {
      throw new ForbiddenException('Only the customer can confirm reception');
    }

    const order = await this.findByIdOrThrow(id);
    if (order.customerId.toString() !== actor.id) {
      throw new ForbiddenException();
    }
    if (order.status !== OrderStatus.Delivered) {
      throw new BadRequestException('Order must be DELIVERED first');
    }
    if (order.customerConfirmation?.confirmed) {
      throw new BadRequestException('Reception already confirmed');
    }

    order.customerConfirmation = {
      confirmed: true,
      confirmedAt: new Date(),
    };
    await order.save();

    await this.emitOrderReceived(order);
    return this.toResponse(order);
  }

  private async cancelOrder(order: OrderDocument, actor: AuthUser) {
    if (
      order.status !== OrderStatus.Pending &&
      order.status !== OrderStatus.Confirmed
    ) {
      throw new BadRequestException(
        'Only PENDING or CONFIRMED orders can be cancelled',
      );
    }

    if (actor.role === Role.Customer && order.customerId.toString() !== actor.id) {
      throw new ForbiddenException();
    }

    if (order.stockReserved) {
      for (const item of order.items) {
        await this.productsService.releaseStock(
          item.productId.toString(),
          item.quantity,
        );
      }
      order.stockReserved = false;
    }

    order.status = OrderStatus.Cancelled;
    order.payment.status = PaymentStatus.Cancelled;
    await order.save();

    await this.emitOrderStatusUpdated(order);
    return this.toResponse(order);
  }

  private assertForwardTransition(from: OrderStatus, to: OrderStatus) {
    if (from === OrderStatus.Cancelled || from === OrderStatus.Delivered) {
      throw new BadRequestException(`Cannot transition from ${from}`);
    }
    const fromIdx = ORDER_STATUS_FLOW.indexOf(from);
    const toIdx = ORDER_STATUS_FLOW.indexOf(to);
    if (fromIdx < 0 || toIdx < 0 || toIdx !== fromIdx + 1) {
      throw new BadRequestException(
        `Invalid status transition ${from} → ${to}`,
      );
    }
  }

  /** Spec §6 / §20: cook accepts (CONFIRMED) before pay; prepare/ship only after PAID */
  private assertPaymentBeforePrepare(order: OrderDocument, next: OrderStatus) {
    const requiresPaid = [
      OrderStatus.Preparing,
      OrderStatus.ReadyToShip,
      OrderStatus.Shipped,
      OrderStatus.Delivered,
    ].includes(next);

    if (requiresPaid && order.payment.status !== PaymentStatus.Paid) {
      throw new BadRequestException(
        'Payment must be PAID before preparing or shipping the order',
      );
    }
  }

  private async rollbackReservations(
    reserved: { productId: string; quantity: number }[],
  ) {
    for (const r of reserved) {
      await this.productsService.releaseStock(r.productId, r.quantity);
    }
  }

  private async nextOrderNumber(): Promise<string> {
    const count = await this.orderModel.countDocuments();
    return `ORDER-${String(count + 1).padStart(6, '0')}`;
  }

  private async findByIdOrThrow(id: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async assertCanView(order: OrderDocument, actor: AuthUser) {
    if (actor.role === Role.Admin) return;
    if (
      actor.role === Role.Customer &&
      order.customerId.toString() === actor.id
    ) {
      return;
    }
    if (actor.role === Role.Cook) {
      const cook = await this.cooksService.findByUserId(actor.id);
      if (cook && cook._id.toString() === order.cookId.toString()) return;
    }
    throw new ForbiddenException();
  }

  private async assertCookOrAdmin(order: OrderDocument, actor: AuthUser) {
    if (actor.role === Role.Admin) return;
    if (actor.role === Role.Cook) {
      const cook = await this.cooksService.findByUserId(actor.id);
      if (cook && cook._id.toString() === order.cookId.toString()) return;
    }
    throw new ForbiddenException('Only the cook or admin can perform this action');
  }

  private toResponse(order: OrderDocument) {
    const obj = order.toObject();
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId.toString(),
      cookId: order.cookId.toString(),
      items: order.items.map((i) => ({
        productId: i.productId.toString(),
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
      totals: order.totals,
      delivery: order.delivery,
      payment: order.payment,
      shipping: order.shipping,
      status: order.status,
      customerConfirmation: order.customerConfirmation,
      createdAt: (obj as { createdAt?: Date }).createdAt,
      updatedAt: (obj as { updatedAt?: Date }).updatedAt,
    };
  }

  private async emitOrderCreated(order: OrderDocument, cookDisplayName: string) {
    const parties = await this.resolveOrderParties(order);
    if (!parties) return;
    await this.notificationsService.notifyOrderCreated({
      customer: parties.customer,
      cook: { ...parties.cook, name: cookDisplayName },
      ctx: this.orderNotificationContext(order, {
        cookName: cookDisplayName,
        customerName: parties.customer.name,
      }),
    });
  }

  private async emitOrderStatusUpdated(order: OrderDocument) {
    const parties = await this.resolveOrderParties(order);
    if (!parties) return;
    await this.notificationsService.notifyOrderStatusUpdated({
      customer: parties.customer,
      cook: parties.cook,
      ctx: this.orderNotificationContext(order, {
        cookName: parties.cookName,
        customerName: parties.customer.name,
        status: order.status,
      }),
    });
  }

  private async emitPaymentStatusUpdated(order: OrderDocument) {
    const parties = await this.resolveOrderParties(order);
    if (!parties) return;
    await this.notificationsService.notifyPaymentStatusUpdated({
      customer: parties.customer,
      cook: parties.cook,
      ctx: this.orderNotificationContext(order, {
        cookName: parties.cookName,
        customerName: parties.customer.name,
        paymentStatus: order.payment.status,
      }),
    });
  }

  private async emitShippingStatusUpdated(order: OrderDocument) {
    const parties = await this.resolveOrderParties(order);
    if (!parties) return;
    await this.notificationsService.notifyShippingStatusUpdated({
      customer: parties.customer,
      cook: parties.cook,
      ctx: this.orderNotificationContext(order, {
        cookName: parties.cookName,
        customerName: parties.customer.name,
        shippingStatus: order.shipping.status,
        carrier: order.shipping.carrier,
        trackingNumber: order.shipping.trackingNumber,
      }),
    });
  }

  private async emitOrderReceived(order: OrderDocument) {
    const parties = await this.resolveOrderParties(order);
    if (!parties) return;
    await this.notificationsService.notifyOrderReceived({
      customer: parties.customer,
      cook: parties.cook,
      ctx: this.orderNotificationContext(order, {
        cookName: parties.cookName,
        customerName: parties.customer.name,
      }),
    });
  }

  private async resolveOrderParties(order: OrderDocument) {
    const cook = await this.cooksService.getById(order.cookId.toString());
    if (!cook) return null;
    const [customer, cookUser] = await Promise.all([
      this.usersService.findById(order.customerId.toString()),
      this.usersService.findById(cook.userId.toString()),
    ]);
    if (!customer || !cookUser) return null;
    return {
      customer: {
        userId: customer.id,
        email: customer.email,
        name: customer.name,
      },
      cook: {
        userId: cookUser.id,
        email: cookUser.email,
        name: cook.displayName,
      },
      cookName: cook.displayName,
    };
  }

  private orderNotificationContext(
    order: OrderDocument,
    extra: {
      cookName: string;
      customerName: string;
      status?: string;
      paymentStatus?: string;
      shippingStatus?: string;
      carrier?: string;
      trackingNumber?: string;
    },
  ) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      cookName: extra.cookName,
      customerName: extra.customerName,
      itemsHtml: order.items
        .map((i) => `<li>${i.name} × ${i.quantity}</li>`)
        .join(''),
      totalFormatted: `$${order.totals.total.toLocaleString('es-CO')}`,
      status: extra.status,
      paymentStatus: extra.paymentStatus,
      shippingStatus: extra.shippingStatus,
      carrier: extra.carrier,
      trackingNumber: extra.trackingNumber,
    };
  }
}
