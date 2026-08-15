import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PromoteAdminDto {
  @ApiProperty({
    description: 'User id to promote to admin',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  userId: string;
}
