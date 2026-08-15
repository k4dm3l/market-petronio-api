import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DeliveryGeoPointDto {
  @ApiProperty({ enum: ['Point'], example: 'Point' })
  @IsIn(['Point'])
  type: 'Point';

  @ApiProperty({
    example: [-77.0319, 3.8833],
    description: '[longitude (-180..180), latitude (-90..90)]',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

export class UpsertDeliveryInformationDto {
  @ApiProperty({ type: DeliveryGeoPointDto })
  @ValidateNested()
  @Type(() => DeliveryGeoPointDto)
  location: DeliveryGeoPointDto;

  @ApiProperty({ example: 'Calle 5 #10-20' })
  @IsString()
  @MinLength(3)
  address: string;

  @ApiPropertyOptional({ example: 'Casa azul, next to the bakery' })
  @IsOptional()
  @IsString()
  additionalInformation?: string;
}
