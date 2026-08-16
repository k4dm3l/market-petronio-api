import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ImageDocument = HydratedDocument<StoredImage>;

export enum ImageType {
  Product = 'PRODUCT',
  User = 'USER',
}

export enum ImageStatus {
  Temporary = 'TEMPORARY',
  Associated = 'ASSOCIATED',
}

export enum ImageEntityType {
  Product = 'PRODUCT',
  User = 'USER',
}

/** Provider-agnostic persisted upload metadata (spec 011) */
@Schema({ timestamps: true, collection: 'images' })
export class StoredImage {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;

  @Prop({ required: true, default: 'cloudinary' })
  provider: string;

  @Prop({ required: true, enum: ImageType })
  type: ImageType;

  @Prop({
    required: true,
    enum: ImageStatus,
    default: ImageStatus.Temporary,
    index: true,
  })
  status: ImageStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  uploadedBy: Types.ObjectId;

  @Prop({ type: String, enum: ImageEntityType, default: null })
  entityType?: ImageEntityType | null;

  @Prop({ type: Types.ObjectId, default: null })
  entityId?: Types.ObjectId | null;
}

export const StoredImageSchema = SchemaFactory.createForClass(StoredImage);
StoredImageSchema.index({ status: 1, createdAt: 1 });
