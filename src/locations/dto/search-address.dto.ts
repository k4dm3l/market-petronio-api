import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SearchAddressQueryDto {
  @ApiProperty({
    example: 'Carrera 5 Cali',
    description: 'Address search text (frontend should debounce 300–500ms)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  query: string;

  @ApiPropertyOptional({ example: 3.4516 })
  @ValidateIf((o: SearchAddressQueryDto) => o.longitude != null)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -76.532 })
  @ValidateIf((o: SearchAddressQueryDto) => o.latitude != null)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Bias radius in meters (requires latitude + longitude)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  radius?: number;
}

export class LocationSearchItemDto {
  @ApiProperty({ example: 'ChIJx...' })
  placeId: string;

  @ApiProperty({
    example: 'Carrera 5 #10-20, Cali, Valle del Cauca, Colombia',
  })
  description: string;
}

export class LocationSearchResponseDto {
  @ApiProperty({ type: [LocationSearchItemDto] })
  data: LocationSearchItemDto[];
}
