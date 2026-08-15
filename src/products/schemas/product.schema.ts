import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductAvailability {
  Available = 'available',
  MadeToOrder = 'made_to_order',
}

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  /** Price in whole COP pesos for MVP */
  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cook', required: true, index: true })
  cookId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ProductAvailability,
    default: ProductAvailability.Available,
  })
  availability: ProductAvailability;

  /** Hours required to prepare the product (spec 004) */
  @Prop({ min: 0, default: 0 })
  preparationTimeHours: number;

  /** Minimum units when made_to_order */
  @Prop({ min: 1, default: 1 })
  minimumOrderQuantity: number;

  /** Normalized searchable tags (lowercase, hyphenated) */
  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Cook toggles whether the product is offered right now */
  @Prop({ default: true })
  isAvailable: boolean;

  /** Admin (or cook) soft-deactivate from catalog */
  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ cookId: 1, isActive: 1, isAvailable: 1 });
ProductSchema.index({ categoryId: 1, isActive: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ tags: 1 });
