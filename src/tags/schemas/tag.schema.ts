import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TagDocument = HydratedDocument<Tag>;

@Schema({ timestamps: true, collection: 'tags' })
export class Tag {
  @Prop({ required: true, trim: true, lowercase: true, maxlength: 50 })
  text: string;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
TagSchema.index({ text: 1 }, { unique: true });
