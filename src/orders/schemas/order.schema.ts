import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderStatus {
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Preparing = 'PREPARING',
  ReadyToShip = 'READY_TO_SHIP',
  Shipped = 'SHIPPED',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}

export enum PaymentStatus {
  Pending = 'PENDING',
  PaymentInstructions = 'PAYMENT_INSTRUCTIONS',
  Paid = 'PAID',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum ShippingStatus {
  Pending = 'PENDING',
  Preparing = 'PREPARING',
  ReadyToShip = 'READY_TO_SHIP',
  Shipped = 'SHIPPED',
  InTransit = 'IN_TRANSIT',
  Delivered = 'DELIVERED',
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  total: number;
}

@Schema({ _id: false })
export class OrderTotals {
  @Prop({ required: true, min: 0 })
  subtotal: number;

  @Prop({ required: true, min: 0, default: 0 })
  shipping: number;

  @Prop({ required: true, min: 0 })
  total: number;
}

@Schema({ _id: false })
export class OrderPayment {
  @Prop({
    required: true,
    enum: PaymentStatus,
    default: PaymentStatus.PaymentInstructions,
  })
  status: PaymentStatus;

  @Prop()
  method?: string;

  @Prop({ default: false })
  customerReportedPaid: boolean;

  @Prop()
  paidAt?: Date;
}

@Schema({ _id: false })
export class OrderShipping {
  @Prop({
    required: true,
    enum: ShippingStatus,
    default: ShippingStatus.Pending,
  })
  status: ShippingStatus;

  @Prop()
  carrier?: string;

  @Prop()
  trackingNumber?: string;

  @Prop()
  shippedAt?: Date;

  @Prop()
  deliveredAt?: Date;
}

@Schema({ _id: false })
export class CustomerConfirmation {
  @Prop({ default: false })
  confirmed: boolean;

  @Prop()
  confirmedAt?: Date;
}

@Schema({ _id: false })
export class OrderDeliveryGeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: 'Point';

  /** [longitude, latitude] — snapshot at order creation */
  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

/** Delivery snapshot on the order (spec 005) — independent of future profile edits */
@Schema({ _id: false })
export class OrderDelivery {
  @Prop({ type: OrderDeliveryGeoPoint, required: true })
  location: OrderDeliveryGeoPoint;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  additionalInformation?: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, unique: true })
  orderNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cook', required: true, index: true })
  cookId: Types.ObjectId;

  @Prop({ type: [OrderItem], required: true })
  items: OrderItem[];

  @Prop({ type: OrderTotals, required: true })
  totals: OrderTotals;

  @Prop({ type: OrderDelivery, required: true })
  delivery: OrderDelivery;

  @Prop({ type: OrderPayment, required: true })
  payment: OrderPayment;

  @Prop({ type: OrderShipping, required: true })
  shipping: OrderShipping;

  @Prop({
    required: true,
    enum: OrderStatus,
    default: OrderStatus.Pending,
    index: true,
  })
  status: OrderStatus;

  @Prop({ type: CustomerConfirmation, default: () => ({ confirmed: false }) })
  customerConfirmation: CustomerConfirmation;

  /** Stock reserved on create for available products; released on cancel */
  @Prop({ default: true })
  stockReserved: boolean;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ cookId: 1, status: 1 });
