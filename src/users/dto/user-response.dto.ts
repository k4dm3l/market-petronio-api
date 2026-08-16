import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { DeliveryGeoPointDto } from './delivery-information.dto';

export class DeliveryInformationResponseDto {
  @ApiProperty({ type: DeliveryGeoPointDto })
  location: DeliveryGeoPointDto;

  @ApiProperty({ example: 'Calle 5 #10-20' })
  address: string;

  @ApiPropertyOptional({ example: 'Casa azul' })
  additionalInformation?: string;
}

export class UserAddressResponseDto {
  @ApiProperty({ example: '01K2ABC...' })
  id: string;

  @ApiProperty({ example: 'Colombia' })
  country: string;

  @ApiProperty({ example: 'Valle del Cauca' })
  department: string;

  @ApiProperty({ example: 'Buenaventura' })
  city: string;

  @ApiProperty({ example: 'Calle 5 #10-20' })
  address: string;

  @ApiPropertyOptional({ example: 'Casa azul, next to the bakery' })
  notes?: string;

  @ApiPropertyOptional({ example: '764501' })
  zipcode?: string;

  @ApiProperty({ type: DeliveryGeoPointDto })
  coordinates: DeliveryGeoPointDto;

  @ApiProperty({ example: true })
  isPrimary: boolean;
}

export class UserImageResponseDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/user.jpg',
  })
  url: string;
}

export class UserMeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'customer@example.com' })
  email: string;

  @ApiProperty({ example: 'María' })
  name: string;

  @ApiProperty({ enum: Role, example: Role.Customer })
  role: Role;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({
    type: UserImageResponseDto,
    nullable: true,
  })
  image: UserImageResponseDto | null;

  @ApiPropertyOptional({
    type: DeliveryInformationResponseDto,
    nullable: true,
    description:
      'Legacy single delivery (spec 005). Prefer `addresses` for new clients.',
  })
  deliveryInformation: DeliveryInformationResponseDto | null;

  @ApiProperty({
    type: [UserAddressResponseDto],
    description: 'Saved addresses; at most one is primary (spec 010)',
  })
  addresses: UserAddressResponseDto[];
}
