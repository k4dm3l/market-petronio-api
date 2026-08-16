import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  ImageDeletedResponseDto,
  ProductImagesUploadResponseDto,
} from '../images/dto/image-upload-response.dto';
import {
  CreateProductDto,
  NearbyProductsDto,
  QueryProductsDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'List products (search, category, cook, price, availability, tags AND, optional lat/lng/radius)',
    description:
      'Cursor pagination (`limit`, `cursor`). Query `tags=seafood,shrimp` uses AND semantics. Pass `lat`+`lng` (+ optional `radius`) to filter by cook proximity. Product `images` are `{ id, url }` objects.',
  })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({
    summary:
      'Products near a geo point (tags AND, category, price; sorted by cook distance)',
    description:
      'Cursor pagination (`limit`, `cursor` encodes distance+product id). Requires `latitude` and `longitude`. Optional `tags` (comma-separated, AND), `categoryId`, `minPrice`/`maxPrice`.',
  })
  nearby(@Query() query: NearbyProductsDto) {
    return this.productsService.findNearby(query);
  }

  @Roles(Role.Cook, Role.Admin)
  @Post('images')
  @ApiOperation({
    summary: 'Upload a product image (no product required)',
    description:
      'multipart field `file`. JPEG/PNG/WEBP, max 5 MB. Persists a TEMPORARY image; pass returned `id` in `POST /products` `images`. Max 5 images per product on create.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, or WEBP image (max 5 MB)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Persisted temporary image(s)',
    type: ProductImagesUploadResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImages(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productsService.uploadImages(user, file);
  }

  @Roles(Role.Cook, Role.Admin)
  @Delete('images/:imageId')
  @ApiOperation({
    summary: 'Delete a product image by id',
    description:
      'Deletes Cloudinary asset + images collection row. If ASSOCIATED, also removes the subdoc from the product. Must be the uploader (or admin).',
  })
  @ApiParam({
    name: 'imageId',
    example: '68af1a2b3c4d5e6f78901234',
    description: 'Id returned by POST /products/images',
  })
  @ApiOkResponse({ type: ImageDeletedResponseDto })
  removeImage(
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.removeImage(imageId, user);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get product by id',
    description:
      'Images are `{ id, url }`. Upload via POST /products/images before create.',
  })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Roles(Role.Cook, Role.Admin)
  @Post()
  @ApiOperation({
    summary:
      'Create product (cook: own catalog; admin: must pass cookId)',
    description:
      'Optional `images`: ids from POST /products/images. Validates ownership + TEMPORARY status, embeds `{ url, publicId }` (same `_id`), marks ASSOCIATED.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  @Roles(Role.Cook, Role.Admin)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update product (owner cook or admin; isActive admin-only)',
  })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, user, dto);
  }

  @Roles(Role.Cook, Role.Admin)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete product (owner cook or admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.remove(id, user);
  }
}
