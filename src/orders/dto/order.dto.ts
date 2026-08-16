import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CursorPaginationQueryDto,
  PaginationMetaDto,
} from '../../common/pagination/cursor-pagination.dto';
import { DeliveryGeoPointDto } from '../../users/dto/delivery-information.dto';
import {
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from '../schemas/order.schema';

export enum DeliverySource {
  CustomerProfile = 'CUSTOMER_PROFILE',
  Custom = 'CUSTOM',
}

export class CreateOrderItemDto {
  @ApiProperty()
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDeliveryDto {
  @ApiProperty({
    enum: DeliverySource,
    example: DeliverySource.CustomerProfile,
    description:
      'CUSTOMER_PROFILE copies saved user delivery; CUSTOM requires location + address',
  })
  @IsEnum(DeliverySource)
  source: DeliverySource;

  @ApiPropertyOptional({
    type: DeliveryGeoPointDto,
    description: 'Required when source is CUSTOM. GeoJSON Point [longitude, latitude]',
  })
  @ValidateIf((o: CreateOrderDeliveryDto) => o.source === DeliverySource.Custom)
  @ValidateNested()
  @Type(() => DeliveryGeoPointDto)
  location?: DeliveryGeoPointDto;

  @ApiPropertyOptional({
    example: 'Calle 5 #10-20',
    description: 'Required when source is CUSTOM (human-readable address)',
  })
  @ValidateIf((o: CreateOrderDeliveryDto) => o.source === DeliverySource.Custom)
  @IsString()
  @MinLength(3)
  address?: string;

  @ApiPropertyOptional({
    example: 'Casa azul, next to the bakery',
    description: 'Optional notes; for CUSTOM only (profile path uses saved notes)',
  })
  @IsOptional()
  @IsString()
  additionalInformation?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Single-cook order (MVP)' })
  @IsMongoId()
  cookId: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ type: CreateOrderDeliveryDto })
  @ValidateNested()
  @Type(() => CreateOrderDeliveryDto)
  delivery: CreateOrderDeliveryDto;

  @ApiPropertyOptional({ example: 10000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ example: 'nequi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  paymentMethod?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class UpdatePaymentDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Customer reports external payment was made',
  })
  @IsOptional()
  @IsBoolean()
  customerReportedPaid?: boolean;
}

export class UpdateShippingDto {
  @ApiProperty({ enum: ShippingStatus })
  @IsEnum(ShippingStatus)
  status: ShippingStatus;

  @ApiPropertyOptional({ example: 'Servientrega' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export class ListOrdersQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({
    enum: OrderStatus,
    example: OrderStatus.Pending,
    description: 'Filter by exact order status',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    example: 'ORD-1001',
    description:
      'Case-insensitive text search: order number, payment method, or (admin) customer name/email. Use `status` to filter by order status.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CustomerOrderHistoryItemDto {
  @ApiProperty({ example: '68af1a2b3c4d5e6f78901234' })
  id: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.Shipped })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.Paid })
  paymentStatus: PaymentStatus;

  @ApiProperty({ example: 75000 })
  total: number;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  createdAt: Date;
}

export class CustomerOrdersListResponseDto {
  @ApiProperty({ type: [CustomerOrderHistoryItemDto] })
  data: CustomerOrderHistoryItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}

export class OrderItemResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  productId: string;

  @ApiProperty({ example: 'Encocado de camarón' })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 35000 })
  unitPrice: number;

  @ApiProperty({ example: 70000 })
  total: number;
}

export class OrderTotalsResponseDto {
  @ApiProperty({ example: 70000 })
  subtotal: number;

  @ApiProperty({ example: 10000 })
  shipping: number;

  @ApiProperty({ example: 80000 })
  total: number;
}

export class OrderDeliveryResponseDto {
  @ApiProperty({
    type: DeliveryGeoPointDto,
    description: 'Snapshot of delivery coordinates at order creation',
  })
  location: DeliveryGeoPointDto;

  @ApiProperty({ example: 'Calle 5 #10-20' })
  address: string;

  @ApiPropertyOptional({
    example: 'Casa azul, next to the bakery',
    nullable: true,
  })
  additionalInformation?: string;
}

export class OrderPaymentResponseDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.Pending })
  status: PaymentStatus;

  @ApiPropertyOptional({ example: 'nequi' })
  method?: string;

  @ApiProperty({ example: false })
  customerReportedPaid: boolean;

  @ApiPropertyOptional({ example: '2026-08-15T12:00:00.000Z' })
  paidAt?: Date;
}

export class OrderShippingResponseDto {
  @ApiProperty({ enum: ShippingStatus, example: ShippingStatus.Pending })
  status: ShippingStatus;

  @ApiPropertyOptional({ example: 'Servientrega' })
  carrier?: string;

  @ApiPropertyOptional({ example: '123456789' })
  trackingNumber?: string;

  @ApiPropertyOptional()
  shippedAt?: Date;

  @ApiPropertyOptional()
  deliveredAt?: Date;
}

export class CustomerConfirmationResponseDto {
  @ApiProperty({ example: false })
  confirmed: boolean;

  @ApiPropertyOptional()
  confirmedAt?: Date;
}

/** Full order detail including delivery snapshot (spec 005) */
export class OrderResponseDto {
  @ApiProperty({ example: '68af1a2b3c4d5e6f78901234' })
  id: string;

  @ApiProperty({ example: 'ORDER-000001' })
  orderNumber: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  cookId: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ type: OrderTotalsResponseDto })
  totals: OrderTotalsResponseDto;

  @ApiProperty({
    type: OrderDeliveryResponseDto,
    description:
      'Delivery address/location copied at create time; not linked to profile updates',
  })
  delivery: OrderDeliveryResponseDto;

  @ApiProperty({ type: OrderPaymentResponseDto })
  payment: OrderPaymentResponseDto;

  @ApiProperty({ type: OrderShippingResponseDto })
  shipping: OrderShippingResponseDto;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.Pending })
  status: OrderStatus;

  @ApiProperty({ type: CustomerConfirmationResponseDto })
  customerConfirmation: CustomerConfirmationResponseDto;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  updatedAt: Date;
}
