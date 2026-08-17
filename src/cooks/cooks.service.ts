import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import {
  applyCreatedAtIdCursor,
  createdAtIdPayload,
  decodeDistanceCursor,
  paginateSlice,
  resolveLimit,
} from '../common/pagination/cursor.util';
import { escapeRegex } from '../common/utils/escape-regex';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { UsersService } from '../users/users.service';
import { CreateCookDto, QueryCooksDto, UpdateCookDto } from './dto/cook.dto';
import { Cook, CookDocument } from './schemas/cook.schema';

@Injectable()
export class CooksService {
  constructor(
    @InjectModel(Cook.name) private cookModel: Model<CookDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly usersService: UsersService,
  ) {}

  async create(actor: AuthUser, dto: CreateCookDto) {
    if (actor.role !== Role.Admin) {
      throw new ForbiddenException('Only admins can create a cook profile');
    }

    const targetUser = await this.usersService.findById(dto.userId);
    if (!targetUser || !targetUser.isActive) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.cookModel
      .findOne({ userId: new Types.ObjectId(dto.userId) })
      .exec();
    if (existing) {
      throw new ConflictException('Cook profile already exists for this user');
    }

    if (targetUser.role !== Role.Cook) {
      await this.usersService.updateRole(dto.userId, Role.Cook);
    }

    const cook = await this.cookModel.create({
      userId: new Types.ObjectId(dto.userId),
      displayName: dto.displayName,
      bio: dto.bio ?? '',
      specialties: dto.specialties ?? [],
      publicLocation: dto.publicLocation,
      location: {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      },
      paymentMethods: (dto.paymentMethods ?? []).map((m) => ({
        type: m.type,
        details: m.details,
        isEnabled: m.isEnabled ?? true,
      })),
      contactWhatsApp: dto.contactWhatsApp,
      isActive: true,
    });

    return this.toOwnerView(cook);
  }

  async findAll(query: QueryCooksDto) {
    const limit = resolveLimit(query.limit);
    const filter: Record<string, unknown> = { isActive: true };
    const useGeo = query.lat != null && query.lng != null;

    if (useGeo) {
      const radius = query.radius ?? 10000;
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.lng, query.lat],
          },
          $maxDistance: radius,
        },
      };
    } else {
      applyCreatedAtIdCursor(filter, query.cursor);
    }

    let q = this.cookModel.find(filter).limit(limit + 1);
    if (!useGeo) {
      q = q.sort({ createdAt: -1, _id: -1 });
    }
    const cooks = await q.exec();

    return paginateSlice(
      cooks,
      limit,
      (c) => this.toPublicView(c),
      (c) => createdAtIdPayload(c as CookDocument & { createdAt?: Date }),
    );
  }

  async listAllForAdmin(
    query: CursorPaginationQueryDto & { search?: string } = {},
  ) {
    const limit = resolveLimit(query.limit);
    const filter: Record<string, unknown> = {};

    if (query.search?.trim()) {
      const q = escapeRegex(query.search.trim());
      const userIds = await this.usersService.findIdsMatchingSearch(
        query.search,
        Role.Cook,
      );
      const or: Record<string, unknown>[] = [
        { displayName: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } },
        { publicLocation: { $regex: q, $options: 'i' } },
        { specialties: { $regex: q, $options: 'i' } },
        { contactWhatsApp: { $regex: q, $options: 'i' } },
      ];
      if (userIds.length) {
        or.push({ userId: { $in: userIds } });
      }
      filter.$or = or;
    }

    applyCreatedAtIdCursor(filter, query.cursor);

    const cooks = await this.cookModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .exec();

    return paginateSlice(
      cooks,
      limit,
      (c) => this.toOwnerView(c),
      (c) => createdAtIdPayload(c as CookDocument & { createdAt?: Date }),
    );
  }

  async countActive(): Promise<number> {
    return this.cookModel.countDocuments({ isActive: true }).exec();
  }

  async setActive(id: string, isActive: boolean) {
    const cook = await this.findByIdOrThrow(id);
    cook.isActive = isActive;
    await cook.save();
    return this.toOwnerView(cook);
  }

  async findOne(id: string, viewer?: AuthUser) {
    const cook = await this.findByIdOrThrow(id);
    if (this.canSeePrivate(cook, viewer)) {
      return this.toOwnerView(cook);
    }
    if (!cook.isActive) {
      throw new NotFoundException('Cook not found');
    }
    return this.toPublicView(cook);
  }

  async findByUserId(userId: string): Promise<CookDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return this.cookModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async ownerProfileForUser(userId: string) {
    const cook = await this.findByUserId(userId);
    return cook ? this.toOwnerView(cook) : null;
  }

  /** Spec §13 — simple cook dashboard aggregates */
  async getDashboard(actor: AuthUser) {
    if (actor.role !== Role.Cook) {
      throw new ForbiddenException('Cook role required');
    }

    const cook = await this.findByUserId(actor.id);
    if (!cook || !cook.isActive) {
      throw new NotFoundException('Cook profile not found');
    }

    const cookId = cook._id;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      pendingOrders,
      preparingOrders,
      shippedOrders,
      monthlySalesRows,
      products,
    ] = await Promise.all([
      this.orderModel.countDocuments({
        cookId,
        status: OrderStatus.Pending,
      }),
      this.orderModel.countDocuments({
        cookId,
        status: {
          $in: [
            OrderStatus.Confirmed,
            OrderStatus.Preparing,
            OrderStatus.ReadyToShip,
          ],
        },
      }),
      this.orderModel.countDocuments({
        cookId,
        status: { $in: [OrderStatus.Shipped, OrderStatus.Delivered] },
      }),
      this.orderModel
        .aggregate<{ total: number }>([
          {
            $match: {
              cookId,
              'payment.status': PaymentStatus.Paid,
              'payment.paidAt': { $gte: startOfMonth },
            },
          },
          { $group: { _id: null, total: { $sum: '$totals.total' } } },
        ])
        .exec(),
      this.productModel
        .find({ cookId, isActive: true })
        .select('name stock isAvailable availability')
        .exec(),
    ]);

    return {
      cookId: cook.id,
      pendingOrders,
      ordersBeingPrepared: preparingOrders,
      shippedOrders,
      monthlySales: monthlySalesRows[0]?.total ?? 0,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        isAvailable: p.isAvailable,
        availability: p.availability,
      })),
    };
  }

  async getById(id: string): Promise<CookDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.cookModel.findById(id).exec();
  }

  async aggregateNearbyProducts(
    lng: number,
    lat: number,
    maxDistanceMeters: number,
    productMatch: Record<string, unknown>,
    pagination: { limit: number; cursor?: string },
  ) {
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: maxDistanceMeters,
          spherical: true,
          query: { isActive: true },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'cookId',
          as: 'products',
        },
      },
      { $unwind: '$products' },
      { $match: productMatch },
    ];

    if (pagination.cursor) {
      const decoded = decodeDistanceCursor(pagination.cursor);
      const productId = new Types.ObjectId(decoded.id);
      pipeline.push({
        $match: {
          $or: [
            { distance: { $gt: decoded.distance } },
            {
              distance: decoded.distance,
              'products._id': { $gt: productId },
            },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { distance: 1, 'products._id': 1 } },
      { $limit: pagination.limit },
      {
        $project: {
          displayName: 1,
          publicLocation: 1,
          distance: 1,
          products: 1,
        },
      },
    );

    return this.cookModel
      .aggregate<{
        _id: Types.ObjectId;
        displayName: string;
        publicLocation: string;
        distance: number;
        products: Record<string, unknown> & { _id: Types.ObjectId };
      }>(pipeline)
      .exec();
  }

  async update(id: string, user: AuthUser, dto: UpdateCookDto) {
    const cook = await this.findByIdOrThrow(id);
    this.assertCanManage(cook, user);

    if (dto.isActive !== undefined && user.role !== Role.Admin) {
      throw new ForbiddenException('Only admins can change isActive');
    }

    if (dto.displayName !== undefined) cook.displayName = dto.displayName;
    if (dto.bio !== undefined) cook.bio = dto.bio;
    if (dto.specialties !== undefined) cook.specialties = dto.specialties;
    if (dto.publicLocation !== undefined) {
      cook.publicLocation = dto.publicLocation;
    }
    if (dto.contactWhatsApp !== undefined) {
      cook.contactWhatsApp = dto.contactWhatsApp;
    }
    if (dto.paymentMethods !== undefined) {
      cook.paymentMethods = dto.paymentMethods.map((m) => ({
        type: m.type,
        details: m.details,
        isEnabled: m.isEnabled ?? true,
      }));
    }
    if (dto.longitude !== undefined || dto.latitude !== undefined) {
      const [lng, lat] = cook.location.coordinates;
      cook.location = {
        type: 'Point',
        coordinates: [dto.longitude ?? lng, dto.latitude ?? lat],
      };
    }
    if (dto.isActive !== undefined) cook.isActive = dto.isActive;

    await cook.save();
    return this.toOwnerView(cook);
  }

  private async findByIdOrThrow(id: string): Promise<CookDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Cook not found');
    }
    const cook = await this.cookModel.findById(id).exec();
    if (!cook) {
      throw new NotFoundException('Cook not found');
    }
    return cook;
  }

  private assertCanManage(cook: CookDocument, user: AuthUser) {
    if (user.role === Role.Admin) return;
    if (
      user.role === Role.Cook &&
      cook.userId.toString() === user.id
    ) {
      return;
    }
    throw new ForbiddenException('You cannot update this cook profile');
  }

  private canSeePrivate(cook: CookDocument, viewer?: AuthUser) {
    if (!viewer) return false;
    if (viewer.role === Role.Admin) return true;
    return (
      viewer.role === Role.Cook && cook.userId.toString() === viewer.id
    );
  }

  private toPublicView(cook: CookDocument) {
    const obj = cook.toObject();
    const { location: _location, ...rest } = obj;
    return {
      ...rest,
      id: cook.id,
      paymentMethods: (cook.paymentMethods ?? [])
        .filter((m) => m.isEnabled)
        .map((m) => ({
          type: m.type,
          details: m.details,
          isEnabled: m.isEnabled,
        })),
    };
  }

  private toOwnerView(cook: CookDocument) {
    const obj = cook.toObject();
    return {
      ...obj,
      id: cook.id,
      userId: cook.userId.toString(),
    };
  }
}
