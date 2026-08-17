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

/** Saved customer address (spec 010) — identified by `id`, not array index */
@Schema({ _id: false })
export class UserAddress {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({ required: true, trim: true })
  department: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  notes?: string;

  /** String — postal codes may have leading zeros / letters */
  @Prop({ trim: true })
  zipcode?: string;

  @Prop({ type: DeliveryGeoPoint, required: true })
  coordinates: DeliveryGeoPoint;

  @Prop({ required: true, default: false })
  isPrimary: boolean;
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

  /** Single default delivery address (spec 005 MVP) — prefer `addresses` for new clients */
  @Prop({ type: DeliveryInformation })
  deliveryInformation?: DeliveryInformation;

  /** Saved addresses; at most one `isPrimary: true` (spec 010) */
  @Prop({ type: [UserAddress], default: [] })
  addresses: UserAddress[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ 'addresses.coordinates': '2dsphere' });
