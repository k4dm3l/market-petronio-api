import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../common/enums/role.enum';

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
}
