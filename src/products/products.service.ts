import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CooksService } from '../cooks/cooks.service';
import { CookDocument } from '../cooks/schemas/cook.schema';
import { CategoriesService } from '../categories/categories.service';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  applyCreatedAtIdCursor,
  createdAtIdPayload,
  paginateSlice,
  resolveLimit,
} from '../common/pagination/cursor.util';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { ImageService } from '../images/image.service';
import {
  ImageEntityType,
  ImageStatus,
  ImageType,
} from '../images/schemas/image.schema';
import { TagsService } from '../tags/tags.service';
import {
  CreateProductDto,
  NearbyProductsDto,
  QueryProductsDto,
  UpdateProductDto,
} from './dto/product.dto';
import { normalizeProductTags, parseTagsQuery } from './product-tags.util';
import {
  Product,
  ProductAvailability,
  ProductDocument,
  ProductImageDocument,
} from './schemas/product.schema';

const MAX_PRODUCT_IMAGES = 5;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly cooksService: CooksService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly imageService: ImageService,
  ) {}

  async create(actor: AuthUser, dto: CreateProductDto) {
    const cook = await this.resolveCookForCreate(actor, dto.cookId);
    this.assertAvailabilityRules(dto);
    await this.assertValidCategory(dto.categoryId);

    const tags = normalizeProductTags(dto.tags);
    await this.tagsService.assertTagsExist(tags);

    const imageIds = dto.images ?? [];
    if (imageIds.length > MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(
        `Products can have at most ${MAX_PRODUCT_IMAGES} images`,
      );
    }

    const claimable = await this.imageService.assertClaimableProductImages(
      imageIds,
      actor.id,
    );

    const productImages = claimable.map(
      (img) =>
        ({
          _id: img._id,
          url: img.url,
          publicId: img.publicId,
        }) as ProductImageDocument,
    );

    const product = await this.productModel.create({
      name: dto.name,
      description: dto.description ?? '',
      images: productImages,
      price: dto.price,
      stock: dto.stock ?? 0,
      categoryId: dto.categoryId
        ? new Types.ObjectId(dto.categoryId)
        : undefined,
      cookId: cook._id,
      availability: dto.availability,
      preparationTimeHours: dto.preparationTimeHours ?? 0,
      minimumOrderQuantity:
        dto.availability === ProductAvailability.MadeToOrder
          ? (dto.minimumOrderQuantity ?? 1)
          : 1,
      tags,
      isAvailable: dto.isAvailable ?? true,
      isActive: true,
    });

    await this.imageService.markAssociatedToProduct(
      claimable.map((img) => img.id),
      product.id,
    );

    return this.toResponse(product, cook);
  }

  async findAll(query: QueryProductsDto) {
    const hasLat = query.lat != null;
    const hasLng = query.lng != null;
    if (hasLat !== hasLng) {
      throw new BadRequestException(
        'lat and lng must be provided together for proximity filtering',
      );
    }

    if (hasLat && hasLng) {
      return this.findNearby({
        latitude: query.lat!,
        longitude: query.lng!,
        radius: query.radius,
        categoryId: query.categoryId,
        tags: query.tags,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        limit: query.limit,
        cursor: query.cursor,
      });
    }

    const limit = resolveLimit(query.limit);
    const filter = this.buildCatalogFilter(query);
    applyCreatedAtIdCursor(filter, query.cursor);

    const products = await this.productModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const page = paginateSlice(
      products,
      limit,
      (p) => p,
      (p) => createdAtIdPayload(p as ProductDocument & { createdAt?: Date }),
    );
    return {
      data: await Promise.all(page.data.map((p) => this.toResponse(p))),
      pagination: page.pagination,
    };
  }

  async listAllForAdmin(query: CursorPaginationQueryDto = {}) {
    const limit = resolveLimit(query.limit);
    const filter: Record<string, unknown> = {};
    applyCreatedAtIdCursor(filter, query.cursor);

    const products = await this.productModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    const page = paginateSlice(
      products,
      limit,
      (p) => p,
      (p) => createdAtIdPayload(p as ProductDocument & { createdAt?: Date }),
    );
    return {
      data: await Promise.all(page.data.map((p) => this.toResponse(p))),
      pagination: page.pagination,
    };
  }

  async countAll(): Promise<number> {
    return this.productModel.countDocuments().exec();
  }

  async setActive(id: string, isActive: boolean) {
    const product = await this.findByIdOrThrow(id);
    product.isActive = isActive;
    if (!isActive) product.isAvailable = false;
    await product.save();
    return this.toResponse(product);
  }

  async findNearby(query: NearbyProductsDto) {
    const limit = resolveLimit(query.limit);
    const radius = query.radius ?? 10000;
    const productMatch: Record<string, unknown> = {
      'products.isActive': true,
      'products.isAvailable': true,
    };
    if (query.categoryId) {
      productMatch['products.categoryId'] = new Types.ObjectId(
        query.categoryId,
      );
    }
    if (query.minPrice != null || query.maxPrice != null) {
      productMatch['products.price'] = {
        ...(query.minPrice != null ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice != null ? { $lte: query.maxPrice } : {}),
      };
    }
    const tags = parseTagsQuery(query.tags);
    if (tags.length) {
      productMatch['products.tags'] = { $all: tags };
    }

    const rows = await this.cooksService.aggregateNearbyProducts(
      query.longitude,
      query.latitude,
      radius,
      productMatch,
      { limit: limit + 1, cursor: query.cursor },
    );

    return paginateSlice(
      rows,
      limit,
      (row) => ({
        ...this.mapProductLean(row.products),
        cook: {
          id: String(row._id),
          displayName: row.displayName,
          publicLocation: row.publicLocation,
        },
        distanceMeters: Math.round(row.distance),
      }),
      (row) => ({
        distance: row.distance,
        id: String(row.products._id),
      }),
    );
  }

  async findOne(id: string) {
    const product = await this.findByIdOrThrow(id);
    if (!product.isActive) {
      throw new NotFoundException('Product not found');
    }
    return this.toResponse(product);
  }

  async update(id: string, actor: AuthUser, dto: UpdateProductDto) {
    const product = await this.findByIdOrThrow(id);
    await this.assertCanManage(product, actor);

    if (dto.isActive !== undefined && actor.role !== Role.Admin) {
      throw new ForbiddenException('Only admins can change isActive');
    }

    const nextAvailability = dto.availability ?? product.availability;
    this.assertAvailabilityRules({
      availability: nextAvailability,
      minimumOrderQuantity:
        dto.minimumOrderQuantity ?? product.minimumOrderQuantity,
    });
    await this.assertValidCategory(dto.categoryId);

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.categoryId !== undefined) {
      product.categoryId = new Types.ObjectId(dto.categoryId);
    }
    if (dto.availability !== undefined) {
      product.availability = dto.availability;
    }
    if (dto.preparationTimeHours !== undefined) {
      product.preparationTimeHours = dto.preparationTimeHours;
    }
    if (dto.minimumOrderQuantity !== undefined) {
      product.minimumOrderQuantity = dto.minimumOrderQuantity;
    }
    if (dto.tags !== undefined) {
      const tags = normalizeProductTags(dto.tags);
      await this.tagsService.assertTagsExist(tags);
      product.tags = tags;
    }
    if (dto.isAvailable !== undefined) product.isAvailable = dto.isAvailable;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    await product.save();
    return this.toResponse(product);
  }

  async remove(id: string, actor: AuthUser) {
    const product = await this.findByIdOrThrow(id);
    await this.assertCanManage(product, actor);
    product.isActive = false;
    product.isAvailable = false;
    await product.save();
    return { id: product.id, deleted: true };
  }

  async uploadImages(
    actor: AuthUser,
    file: Express.Multer.File | undefined,
  ) {
    // Cooks/admins only (enforced by controller roles)
    const image = await this.imageService.uploadTemporaryProductImage(
      file,
      actor.id,
    );
    return { images: [this.imageService.toUploadItem(image)] };
  }

  async removeImage(imageId: string, actor: AuthUser) {
    const image = await this.imageService.findById(imageId);
    if (!image) throw new NotFoundException('Image not found');

    if (
      actor.role !== Role.Admin &&
      image.uploadedBy.toString() !== actor.id
    ) {
      throw new ForbiddenException('You cannot delete this image');
    }

    if (image.type !== ImageType.Product) {
      throw new BadRequestException('Not a product image');
    }

    // Keep product.images in sync when already associated
    if (
      image.status === ImageStatus.Associated &&
      image.entityType === ImageEntityType.Product &&
      image.entityId
    ) {
      await this.productModel
        .updateOne(
          { _id: image.entityId },
          { $pull: { images: { _id: image._id } } },
        )
        .exec();
    }

    await this.imageService.deletePersisted(image);
    return { id: imageId, deleted: true };
  }

  private buildCatalogFilter(query: QueryProductsDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      isActive: true,
      isAvailable: query.isAvailable ?? true,
    };

    if (query.search?.trim()) {
      filter.name = { $regex: query.search.trim(), $options: 'i' };
    }
    if (query.categoryId) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }
    if (query.cookId) {
      filter.cookId = new Types.ObjectId(query.cookId);
    }
    if (query.availability) {
      filter.availability = query.availability;
    }
    if (query.minPrice != null || query.maxPrice != null) {
      filter.price = {
        ...(query.minPrice != null ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice != null ? { $lte: query.maxPrice } : {}),
      };
    }
    const tags = parseTagsQuery(query.tags);
    if (tags.length) {
      filter.tags = { $all: tags };
    }

    return filter;
  }

  private async resolveCookForCreate(
    actor: AuthUser,
    cookId?: string,
  ): Promise<CookDocument> {
    if (actor.role === Role.Cook) {
      const cook = await this.cooksService.findByUserId(actor.id);
      if (!cook || !cook.isActive) {
        throw new ForbiddenException('Cook profile required to create products');
      }
      return cook;
    }

    if (actor.role === Role.Admin) {
      if (!cookId) {
        throw new BadRequestException('cookId is required for admin creates');
      }
      const cook = await this.cooksService.getById(cookId);
      if (!cook || !cook.isActive) {
        throw new NotFoundException('Cook not found');
      }
      return cook;
    }

    throw new ForbiddenException('Only cooks or admins can create products');
  }

  private async assertCanManage(product: ProductDocument, actor: AuthUser) {
    if (actor.role === Role.Admin) return;

    if (actor.role === Role.Cook) {
      const cook = await this.cooksService.findByUserId(actor.id);
      if (cook && cook._id.toString() === product.cookId.toString()) {
        return;
      }
    }

    throw new ForbiddenException('You cannot manage this product');
  }

  private assertAvailabilityRules(dto: {
    availability: ProductAvailability;
    minimumOrderQuantity?: number;
  }) {
    if (
      dto.availability === ProductAvailability.MadeToOrder &&
      (dto.minimumOrderQuantity == null || dto.minimumOrderQuantity < 1)
    ) {
      throw new BadRequestException(
        'minimumOrderQuantity is required for made_to_order products',
      );
    }
  }

  private async assertValidCategory(categoryId?: string) {
    if (!categoryId) return;
    const category = await this.categoriesService.findActiveById(categoryId);
    if (!category) {
      throw new BadRequestException('Invalid or inactive categoryId');
    }
  }

  private async findByIdOrThrow(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Product not found');
    }
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async getById(id: string): Promise<ProductDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.productModel.findById(id).exec();
  }

  /** Atomic reserve for in-stock products (PENDING order). */
  async reserveStock(productId: string, quantity: number): Promise<void> {
    const updated = await this.productModel
      .findOneAndUpdate(
        {
          _id: productId,
          isActive: true,
          isAvailable: true,
          availability: ProductAvailability.Available,
          stock: { $gte: quantity },
        },
        { $inc: { stock: -quantity } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId}`,
      );
    }
  }

  async releaseStock(productId: string, quantity: number): Promise<void> {
    await this.productModel
      .findByIdAndUpdate(productId, { $inc: { stock: quantity } })
      .exec();
  }

  private async toResponse(product: ProductDocument, cook?: CookDocument) {
    const cookDoc =
      cook ?? (await this.cooksService.getById(product.cookId.toString()));

    return {
      ...this.mapProductLean(
        product.toObject() as unknown as Record<string, unknown>,
      ),
      cook: cookDoc
        ? {
            id: cookDoc.id,
            displayName: cookDoc.displayName,
            publicLocation: cookDoc.publicLocation,
          }
        : undefined,
    };
  }

  private mapProductLean(obj: Record<string, unknown>) {
    const rawImages = (obj.images as unknown[]) ?? [];
    const images = rawImages.map((img) => {
      // Legacy string URLs from before spec 006
      if (typeof img === 'string') {
        return { id: null, url: img };
      }
      const row = img as Record<string, unknown>;
      const publicId = row.publicId as string | undefined;
      return {
        id: row._id ? String(row._id) : null,
        url: publicId
          ? this.imageService.getDeliveryUrl(publicId, 'product')
          : (row.url as string),
      };
    });

    return {
      id: String(obj._id),
      name: obj.name,
      description: obj.description,
      images,
      price: obj.price,
      stock: obj.stock,
      categoryId: obj.categoryId ? String(obj.categoryId) : undefined,
      cookId: String(obj.cookId),
      availability: obj.availability,
      preparationTimeHours: obj.preparationTimeHours ?? 0,
      minimumOrderQuantity: obj.minimumOrderQuantity,
      tags: (obj.tags as string[] | undefined) ?? [],
      isAvailable: obj.isAvailable,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
