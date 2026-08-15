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
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ProductImageUploadResponseDto, ImageDeletedResponseDto } from '../images/dto/image-upload-response.dto';
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
      'Query `tags=seafood,shrimp` uses AND semantics. Pass `lat`+`lng` (+ optional `radius`) to filter by cook proximity. Product `images` are `{ id, url }` objects.',
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
      'Requires `latitude` and `longitude`. Optional `tags` (comma-separated, AND), `categoryId`, `minPrice`/`maxPrice`.',
  })
  nearby(@Query() query: NearbyProductsDto) {
    return this.productsService.findNearby(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get product by id',
    description: 'Images are `{ id, url }` (upload via POST /products/:id/images).',
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
      'Supports `preparationTimeHours` and optional `tags`. Upload images via POST /products/:id/images after create (max 5).',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  @Roles(Role.Cook, Role.Admin)
  @Post(':id/images')
  @ApiOperation({
    summary: 'Upload a product image (max 5 per product)',
    description:
      'multipart field `file`. JPEG/PNG/WEBP, max 5 MB. Owner cook or admin only. Returns `{ id, url }`.',
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
    description: 'Uploaded image id and public URL',
    type: ProductImageUploadResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productsService.addImage(id, user, file);
  }

  @Roles(Role.Cook, Role.Admin)
  @Delete(':id/images/:imageId')
  @ApiOperation({
    summary: 'Delete a product image',
    description:
      'Removes the Cloudinary asset and the image subdocument. `imageId` comes from product.images[].id.',
  })
  @ApiOkResponse({ type: ImageDeletedResponseDto })
  removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.removeImage(id, imageId, user);
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
