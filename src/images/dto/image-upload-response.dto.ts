import { ApiProperty } from '@nestjs/swagger';

export class ImageUploadResponseDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
  })
  url: string;
}

export class ProductImageUploadResponseDto extends ImageUploadResponseDto {
  @ApiProperty({
    example: '68af1a2b3c4d5e6f78901234',
    description: 'Subdocument id — use with DELETE /products/:id/images/:imageId',
  })
  id: string;
}

export class ImageDeletedResponseDto {
  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({
    required: false,
    example: '68af1a2b3c4d5e6f78901234',
    description: 'Present for product image deletes',
  })
  id?: string;
}
