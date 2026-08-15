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
