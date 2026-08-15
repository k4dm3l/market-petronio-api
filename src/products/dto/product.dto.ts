import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ProductAvailability } from '../schemas/product.schema';

export class CreateProductDto {
  @ApiProperty({ example: 'Encocado de camarón' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Traditional Pacific shrimp stew' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 35000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Stock units (used when availability=available)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Required for admin; ignored for cooks (uses their profile)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  cookId?: string;

  @ApiProperty({
    enum: ProductAvailability,
    example: ProductAvailability.Available,
  })
  @IsEnum(ProductAvailability)
  availability: ProductAvailability;

  @ApiPropertyOptional({
    example: 48,
    description: 'Preparation time in hours (e.g. 48 = 2 days)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTimeHours?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Required minimum when made_to_order',
  })
  @ValidateIf(
    (o: CreateProductDto) => o.availability === ProductAvailability.MadeToOrder,
  )
  @IsInt()
  @Min(1)
  minimumOrderQuantity?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['seafood', 'shrimp', 'traditional', 'pacific-food'],
    description: 'Normalized to lowercase/hyphenated; max 10; unique',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ProductAvailability })
  @IsOptional()
  @IsEnum(ProductAvailability)
  availability?: ProductAvailability;

  @ApiPropertyOptional({
    example: 24,
    description: 'Preparation time in hours',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  minimumOrderQuantity?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['seafood', 'shrimp'],
    description: 'Normalized to lowercase/hyphenated; max 10; unique',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Admin soft-deactivate' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryProductsDto {
  @ApiPropertyOptional({ description: 'Case-insensitive name search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  cookId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Defaults to true (only available products in catalog)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ enum: ProductAvailability })
  @IsOptional()
  @IsEnum(ProductAvailability)
  availability?: ProductAvailability;

  @ApiPropertyOptional({
    example: 'seafood,shrimp',
    description:
      'Comma-separated tags; AND semantics (product must include all). Normalized lowercase.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined))
  tags?: string;

  @ApiPropertyOptional({
    description: 'With lng+radius: proximity filter on GET /products',
    example: 3.8833,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -77.0319 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 10000, description: 'Radius in meters' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  radius?: number;
}

export class NearbyProductsDto {
  @ApiProperty({ example: 3.8833 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -77.0319 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Radius in meters',
    example: 10000,
    default: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  radius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'seafood,shrimp',
    description: 'Comma-separated tags; AND semantics',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
