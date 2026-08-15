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
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from '../schemas/order.schema';

export class CreateOrderItemDto {
  @ApiProperty()
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
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

export class ListOrdersQueryDto {
  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Page size (max 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Opaque cursor from the previous page (do not pass customerId)',
    example: 'eyJpZCI6IjY4YWYiLCJjcmVhdGVkQXQiOiIyMDI2LTA4LTE1VDEwOjAwOjAwLjAwMFoifQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
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

export class OrdersPaginationDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 'eyJpZCI6IjY4YWYiLCJjcmVhdGVkQXQiOiIyMDI2LTA4LTE1VDEwOjAwOjAwLjAwMFoifQ',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

export class CustomerOrdersListResponseDto {
  @ApiProperty({ type: [CustomerOrderHistoryItemDto] })
  data: CustomerOrderHistoryItemDto[];

  @ApiProperty({ type: OrdersPaginationDto })
  pagination: OrdersPaginationDto;
}
