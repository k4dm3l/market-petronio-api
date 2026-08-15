import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { UpsertDeliveryInformationDto } from './dto/delivery-information.dto';
import {
  DeliveryInformation,
  User,
  UserDocument,
} from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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

  listByRole(role: Role, limit = 100): Promise<UserDocument[]> {
    return this.userModel
      .find({ role })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-passwordHash')
      .exec();
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
      deliveryInformation: user.deliveryInformation ?? null,
    };
  }
}
