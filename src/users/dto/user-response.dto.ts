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
    type: DeliveryInformationResponseDto,
    nullable: true,
    description: 'Default delivery info used with orders source=CUSTOMER_PROFILE',
  })
  deliveryInformation: DeliveryInformationResponseDto | null;
}
