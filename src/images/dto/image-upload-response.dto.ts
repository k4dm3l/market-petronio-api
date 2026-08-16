import { ApiProperty } from '@nestjs/swagger';

export class ImageUploadResponseDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
  })
  url: string;
}

export class ProductImageItemDto {
  @ApiProperty({
    example: '68af1a2b3c4d5e6f78901234',
    description: 'Persisted image id — send in POST /products `images`',
  })
  id: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
  })
  url: string;

  @ApiProperty({
    example: 'products/temp/abc123',
    description: 'Provider public id (Cloudinary)',
  })
  publicId: string;
}

/** POST /products/images response (spec 011) */
export class ProductImagesUploadResponseDto {
  @ApiProperty({ type: [ProductImageItemDto] })
  images: ProductImageItemDto[];
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
