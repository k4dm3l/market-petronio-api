import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class DeliveryGeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: 'Point';

  /** [longitude, latitude] */
  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

@Schema({ _id: false })
export class DeliveryInformation {
  @Prop({ type: DeliveryGeoPoint, required: true })
  location: DeliveryGeoPoint;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  additionalInformation?: string;
}

@Schema({ _id: false })
export class UserImage {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: Role, default: Role.Customer })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  /** Profile image (single); replace on re-upload */
  @Prop({ type: UserImage })
  image?: UserImage;

  /** Single default delivery address (spec 005 MVP) */
  @Prop({ type: DeliveryInformation })
  deliveryInformation?: DeliveryInformation;
}

export const UserSchema = SchemaFactory.createForClass(User);
