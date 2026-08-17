import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationCoordinatesDto {
  @ApiProperty({ example: 3.4516 })
  latitude: number;

  @ApiProperty({ example: -76.532 })
  longitude: number;
}

export class AddressDetailsResponseDto {
  @ApiProperty({ example: 'ChIJx...' })
  placeId: string;

  @ApiProperty({
    example: 'Carrera 5 #10-20, Cali, Valle del Cauca, Colombia',
  })
  formattedAddress: string;

  @ApiProperty({ example: 'Colombia' })
  country: string;

  @ApiPropertyOptional({ example: 'Valle del Cauca' })
  department?: string;

  @ApiPropertyOptional({ example: 'Cali' })
  city?: string;

  @ApiPropertyOptional({ example: 'Carrera 5 #10-20' })
  address?: string;

  @ApiPropertyOptional({ example: '760001' })
  zipcode?: string;

  @ApiProperty({ type: LocationCoordinatesDto })
  coordinates: LocationCoordinatesDto;
}
