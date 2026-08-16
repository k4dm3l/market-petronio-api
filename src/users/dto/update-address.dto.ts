import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeliveryGeoPointDto } from './delivery-information.dto';

export class CreateAddressDto {
  @ApiProperty({ example: 'Colombia' })
  @IsString()
  @MinLength(1)
  country: string;

  @ApiProperty({ example: 'Valle del Cauca' })
  @IsString()
  @MinLength(1)
  department: string;

  @ApiProperty({ example: 'Buenaventura' })
  @IsString()
  @MinLength(1)
  city: string;

  @ApiProperty({ example: 'Calle 5 #10-20' })
  @IsString()
  @MinLength(3)
  address: string;

  @ApiPropertyOptional({ example: 'Casa azul, next to the bakery' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '764501' })
  @IsOptional()
  @IsString()
  zipcode?: string;

  @ApiProperty({
    type: DeliveryGeoPointDto,
    description: 'GeoJSON Point [longitude, latitude]',
  })
  @ValidateNested()
  @Type(() => DeliveryGeoPointDto)
  coordinates: DeliveryGeoPointDto;

  @ApiPropertyOptional({
    example: true,
    description:
      'If true (or if this is the first address), demotes any previous primary',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

/** Partial update — send only fields to change (spec 010) */
export class UpdateAddressDto {
  @ApiPropertyOptional({ example: 'Colombia' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  country?: string;

  @ApiPropertyOptional({ example: 'Valle del Cauca' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  department?: string;

  @ApiPropertyOptional({ example: 'Cali' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  city?: string;

  @ApiPropertyOptional({ example: 'Carrera 10 #20-30' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  address?: string;

  @ApiPropertyOptional({ example: 'Apartment 302' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '760001' })
  @IsOptional()
  @IsString()
  zipcode?: string;

  @ApiPropertyOptional({
    type: DeliveryGeoPointDto,
    description: 'GeoJSON Point [longitude, latitude]',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryGeoPointDto)
  coordinates?: DeliveryGeoPointDto;

  @ApiPropertyOptional({
    example: true,
    description:
      'Setting true demotes other primaries atomically. Setting false on the current primary is rejected.',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
