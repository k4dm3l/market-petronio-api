import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CookDocument = HydratedDocument<Cook>;

export enum PaymentMethodType {
  Nequi = 'nequi',
  Daviplata = 'daviplata',
  BankTransfer = 'bank_transfer',
}

@Schema({ _id: false })
export class PaymentMethod {
  @Prop({ required: true, enum: PaymentMethodType })
  type: PaymentMethodType;

  @Prop({ required: true, trim: true })
  details: string;

  @Prop({ default: true })
  isEnabled: boolean;
}

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: 'Point';

  /** [longitude, latitude] */
  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

@Schema({ timestamps: true, collection: 'cooks' })
export class Cook {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ trim: true, default: '' })
  bio: string;

  @Prop({ type: [String], default: [] })
  specialties: string[];

  /** Public label only, e.g. "Buenaventura, Valle del Cauca" */
  @Prop({ required: true, trim: true })
  publicLocation: string;

  @Prop({ type: GeoPoint, required: true })
  location: GeoPoint;

  @Prop({ type: [PaymentMethod], default: [] })
  paymentMethods: PaymentMethod[];

  @Prop({ trim: true })
  contactWhatsApp?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CookSchema = SchemaFactory.createForClass(Cook);
CookSchema.index({ location: '2dsphere' });
CookSchema.index({ isActive: 1 });
