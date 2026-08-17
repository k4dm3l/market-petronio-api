import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { CursorPaginationQueryDto } from '../../common/pagination/cursor-pagination.dto';
import { PaymentMethodType } from '../schemas/cook.schema';

function parseTagsQueryParam(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const parts = Array.isArray(value) ? value : String(value).split(',');
  const tags = [
    ...new Set(parts.map((t) => String(t).trim()).filter(Boolean)),
  ];
  return tags.length ? tags : undefined;
}

export class PaymentMethodDto {
  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiProperty({ example: 'Nequi 3001234567' })
  @IsString()
  @MinLength(3)
  details: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class CreateCookDto {
  @ApiProperty({
    description: 'Existing user id that will own this cook profile',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({ example: 'María Rodríguez' })
  @IsString()
  @MinLength(2)
  displayName: string;

  @ApiPropertyOptional({ example: 'Traditional cook from the Pacific region.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: ['Seafood', 'Coconut candies', 'Tamales'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiProperty({ example: 'Buenaventura, Valle del Cauca' })
  @IsString()
  @MinLength(2)
  publicLocation: string;

  @ApiProperty({
    description: 'Longitude (GeoJSON order)',
    example: -77.0319,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    description: 'Latitude (GeoJSON order)',
    example: 3.8833,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiPropertyOptional({ type: [PaymentMethodDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods?: PaymentMethodDto[];

  @ApiPropertyOptional({ example: '3001234567' })
  @IsOptional()
  @IsString()
  contactWhatsApp?: string;
}

export class UpdateCookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  publicLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ type: [PaymentMethodDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods?: PaymentMethodDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactWhatsApp?: string;

  @ApiPropertyOptional({ description: 'Admin only' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryCooksDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ example: 3.8833 })
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

  @ApiPropertyOptional({
    description: 'Search radius in meters',
    example: 10000,
    default: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  radius?: number;

  @ApiPropertyOptional({
    example: 'Seafood,Tamales',
    description:
      'Match cooks whose specialties include any of these tags (`$in`). Comma-separated or repeated `tags`.',
  })
  @IsOptional()
  @Transform(({ value }) => parseTagsQueryParam(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class QueryAdminCooksDto extends SearchQueryDto {
  @ApiPropertyOptional({
    example: 'Seafood,Tamales',
    description:
      'Match cooks whose specialties include any of these tags (`$in`). Comma-separated or repeated `tags`.',
  })
  @IsOptional()
  @Transform(({ value }) => parseTagsQueryParam(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
