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
  CreateProductDto,
  NearbyProductsDto,
  QueryProductsDto,
  UpdateProductDto,
} from './dto/product.dto';
import {
  Product,
  ProductAvailability,
  ProductDocument,
} from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly cooksService: CooksService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(actor: AuthUser, dto: CreateProductDto) {
    const cook = await this.resolveCookForCreate(actor, dto.cookId);
    this.assertAvailabilityRules(dto);
    await this.assertValidCategory(dto.categoryId);

    const product = await this.productModel.create({
      name: dto.name,
      description: dto.description ?? '',
      images: dto.images ?? [],
      price: dto.price,
      stock: dto.stock ?? 0,
      categoryId: dto.categoryId
        ? new Types.ObjectId(dto.categoryId)
        : undefined,
      cookId: cook._id,
      availability: dto.availability,
      preparationTimeDays: dto.preparationTimeDays ?? 0,
      minimumOrderQuantity:
        dto.availability === ProductAvailability.MadeToOrder
          ? (dto.minimumOrderQuantity ?? 1)
          : 1,
      isAvailable: dto.isAvailable ?? true,
      isActive: true,
    });

    return this.toResponse(product, cook);
  }

  async findAll(query: QueryProductsDto) {
    const filter: Record<string, unknown> = {
      isActive: true,
      // Spec: catalog filters by availability; default hide cook-disabled products
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

    const products = await this.productModel.find(filter).limit(50).exec();
    return Promise.all(products.map((p) => this.toResponse(p)));
  }

  async listAllForAdmin(limit = 100) {
    const products = await this.productModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    return Promise.all(products.map((p) => this.toResponse(p)));
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

    const rows = await this.cooksService.aggregateNearbyProducts(
      query.longitude,
      query.latitude,
      radius,
      productMatch,
    );

    return rows.map((row) => ({
      ...this.mapProductLean(row.products),
      cook: {
        id: String(row._id),
        displayName: row.displayName,
        publicLocation: row.publicLocation,
      },
      distanceMeters: Math.round(row.distance),
    }));
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
    if (dto.images !== undefined) product.images = dto.images;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.categoryId !== undefined) {
      product.categoryId = new Types.ObjectId(dto.categoryId);
    }
    if (dto.availability !== undefined) {
      product.availability = dto.availability;
    }
    if (dto.preparationTimeDays !== undefined) {
      product.preparationTimeDays = dto.preparationTimeDays;
    }
    if (dto.minimumOrderQuantity !== undefined) {
      product.minimumOrderQuantity = dto.minimumOrderQuantity;
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
    return {
      id: String(obj._id),
      name: obj.name,
      description: obj.description,
      images: obj.images,
      price: obj.price,
      stock: obj.stock,
      categoryId: obj.categoryId ? String(obj.categoryId) : undefined,
      cookId: String(obj.cookId),
      availability: obj.availability,
      preparationTimeDays: obj.preparationTimeDays,
      minimumOrderQuantity: obj.minimumOrderQuantity,
      isAvailable: obj.isAvailable,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }
}
