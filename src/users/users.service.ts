import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import {
  applyCreatedAtIdCursor,
  createdAtIdPayload,
  paginateSlice,
  resolveLimit,
} from '../common/pagination/cursor.util';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination.dto';
import { escapeRegex } from '../common/utils/escape-regex';
import { ImageService } from '../images/image.service';
import { UpsertDeliveryInformationDto } from './dto/delivery-information.dto';
import {
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/update-address.dto';
import {
  DeliveryInformation,
  User,
  UserDocument,
} from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly imageService: ImageService,
  ) {}

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: Role;
  }): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateRole(id: string, role: Role): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { role }, { new: true })
      .exec();
  }

  async listByRole(
    role: Role,
    options: CursorPaginationQueryDto & { search?: string } = {},
  ) {
    const limit = resolveLimit(options.limit);
    const filter: Record<string, unknown> = { role };

    if (options.search?.trim()) {
      const q = escapeRegex(options.search.trim());
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    applyCreatedAtIdCursor(filter, options.cursor);

    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .select('-passwordHash')
      .exec();

    return paginateSlice(
      users,
      limit,
      (u) => u,
      (u) => createdAtIdPayload(u as UserDocument & { createdAt?: Date }),
    );
  }

  /** ObjectIds of users matching name/email (optionally by role). */
  async findIdsMatchingSearch(
    search: string,
    role?: Role,
  ): Promise<Types.ObjectId[]> {
    const trimmed = search.trim();
    if (!trimmed) return [];

    const q = escapeRegex(trimmed);
    const filter: Record<string, unknown> = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    };
    if (role) filter.role = role;

    const users = await this.userModel
      .find(filter)
      .select('_id')
      .limit(200)
      .exec();
    return users.map((u) => u._id as Types.ObjectId);
  }

  countByRole(role: Role): Promise<number> {
    return this.userModel.countDocuments({ role }).exec();
  }

  async setActive(id: string, isActive: boolean): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { isActive }, { new: true })
      .select('-passwordHash')
      .exec();
  }

  async updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { passwordHash }, { new: true })
      .exec();
  }

  async getMe(id: string) {
    const user = await this.userModel.findById(id).select('-passwordHash').exec();
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async upsertDeliveryInformation(id: string, dto: UpsertDeliveryInformationDto) {
    this.assertCoordinates(dto.location.coordinates);

    const deliveryInformation: DeliveryInformation = {
      location: {
        type: 'Point',
        coordinates: [
          dto.location.coordinates[0],
          dto.location.coordinates[1],
        ],
      },
      address: dto.address.trim(),
      additionalInformation: dto.additionalInformation?.trim() || undefined,
    };

    const user = await this.userModel
      .findByIdAndUpdate(id, { deliveryInformation }, { new: true })
      .select('-passwordHash')
      .exec();

    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    this.assertCoordinates(dto.coordinates.coordinates);

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const addresses = [...(user.addresses ?? [])];
    const makePrimary = addresses.length === 0 || dto.isPrimary === true;

    if (makePrimary) {
      for (const existing of addresses) {
        existing.isPrimary = false;
      }
    }

    addresses.push({
      id: randomUUID(),
      country: dto.country.trim(),
      department: dto.department.trim(),
      city: dto.city.trim(),
      address: dto.address.trim(),
      notes: dto.notes?.trim() || undefined,
      zipcode: dto.zipcode?.trim() || undefined,
      coordinates: {
        type: 'Point',
        coordinates: [
          dto.coordinates.coordinates[0],
          dto.coordinates.coordinates[1],
        ],
      },
      isPrimary: makePrimary,
    });

    user.addresses = addresses;
    await user.save();
    return this.toPublic(user);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    if (!this.hasAddressPatch(dto)) {
      throw new BadRequestException('At least one field is required');
    }

    if (dto.coordinates) {
      this.assertCoordinates(dto.coordinates.coordinates);
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const addresses = [...(user.addresses ?? [])];
    const current = addresses.find((a) => a.id === addressId);
    if (!current) throw new NotFoundException('Address not found');

    if (dto.isPrimary === false && current.isPrimary) {
      throw new BadRequestException(
        'Cannot unset the primary address. Promote another address with isPrimary: true first.',
      );
    }

    if (dto.country !== undefined) current.country = dto.country.trim();
    if (dto.department !== undefined) current.department = dto.department.trim();
    if (dto.city !== undefined) current.city = dto.city.trim();
    if (dto.address !== undefined) current.address = dto.address.trim();
    if (dto.notes !== undefined) current.notes = dto.notes.trim();
    if (dto.zipcode !== undefined) current.zipcode = dto.zipcode.trim();
    if (dto.coordinates) {
      current.coordinates = {
        type: 'Point',
        coordinates: [
          dto.coordinates.coordinates[0],
          dto.coordinates.coordinates[1],
        ],
      };
    }

    if (dto.isPrimary === true) {
      for (const address of addresses) {
        address.isPrimary = address.id === addressId;
      }
    }

    user.addresses = addresses;
    await user.save();
    return this.toPublic(user);
  }

  async deleteAddress(userId: string, addressId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const addresses = [...(user.addresses ?? [])];
    const index = addresses.findIndex((a) => a.id === addressId);
    if (index === -1) throw new NotFoundException('Address not found');

    const wasPrimary = addresses[index].isPrimary;
    addresses.splice(index, 1);

    // Keep invariant: if any addresses remain, exactly one is primary
    if (wasPrimary && addresses.length > 0 && !addresses.some((a) => a.isPrimary)) {
      addresses[0].isPrimary = true;
    }

    user.addresses = addresses;
    await user.save();

    return this.toPublic(user);
  }

  async uploadProfileImage(
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const previousPublicId = user.image?.publicId;
    const uploaded = await this.imageService.upload(file, {
      folder: `users/${user.id}`,
      variant: 'avatar',
    });

    user.image = { url: uploaded.url, publicId: uploaded.publicId };
    await user.save();

    if (previousPublicId && previousPublicId !== uploaded.publicId) {
      await this.imageService.delete(previousPublicId).catch(() => undefined);
    }

    return { url: uploaded.url };
  }

  async deleteProfileImage(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    if (!user.image?.publicId) {
      throw new BadRequestException('No profile image to delete');
    }

    await this.imageService.delete(user.image.publicId);
    user.set('image', undefined);
    await user.save();

    return { deleted: true };
  }

  /** Snapshot-ready copy of saved delivery info, or null if unset. */
  getDeliverySnapshot(user: UserDocument): DeliveryInformation | null {
    const info = user.deliveryInformation;
    if (!info?.address?.trim() || !info.location?.coordinates?.length) {
      return null;
    }
    return {
      location: {
        type: 'Point',
        coordinates: [
          info.location.coordinates[0],
          info.location.coordinates[1],
        ],
      },
      address: info.address,
      additionalInformation: info.additionalInformation,
    };
  }

  /** Resolve a saved address (by id, or primary) into an order delivery snapshot. */
  getAddressDeliverySnapshot(
    user: UserDocument,
    addressId?: string,
  ): DeliveryInformation | null {
    const addresses = user.addresses ?? [];
    const match = addressId
      ? addresses.find((a) => a.id === addressId)
      : addresses.find((a) => a.isPrimary) ?? addresses[0];

    if (!match) return null;

    return {
      location: {
        type: 'Point',
        coordinates: [
          match.coordinates.coordinates[0],
          match.coordinates.coordinates[1],
        ],
      },
      address: [
        match.address,
        match.city,
        match.department,
        match.country,
      ].join(', '),
      additionalInformation: match.notes,
    };
  }

  private hasAddressPatch(dto: UpdateAddressDto): boolean {
    return (
      dto.country !== undefined ||
      dto.department !== undefined ||
      dto.city !== undefined ||
      dto.address !== undefined ||
      dto.notes !== undefined ||
      dto.zipcode !== undefined ||
      dto.coordinates !== undefined ||
      dto.isPrimary !== undefined
    );
  }

  private assertCoordinates(coordinates: [number, number]) {
    const [lng, lat] = coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new BadRequestException(
        'coordinates must be [longitude (-180..180), latitude (-90..90)]',
      );
    }
  }

  private toPublic(user: UserDocument) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      image: user.image?.publicId
        ? {
            url: this.imageService.getDeliveryUrl(
              user.image.publicId,
              'avatar',
            ),
          }
        : user.image?.url
          ? { url: user.image.url }
          : null,
      deliveryInformation: user.deliveryInformation ?? null,
      addresses: (user.addresses ?? []).map((a) => ({
        id: a.id,
        country: a.country,
        department: a.department,
        city: a.city,
        address: a.address,
        notes: a.notes,
        zipcode: a.zipcode,
        coordinates: a.coordinates,
        isPrimary: a.isPrimary,
      })),
    };
  }
}
