import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
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
      'Query `tags=seafood,shrimp` uses AND semantics. Pass `lat`+`lng` (+ optional `radius`) to filter by cook proximity.',
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
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Roles(Role.Cook, Role.Admin)
  @Post()
  @ApiOperation({
    summary:
      'Create product (cook: own catalog; admin: must pass cookId)',
    description:
      'Supports `preparationTimeHours` and optional `tags` (normalized lowercase/hyphenated, max 10).',
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
