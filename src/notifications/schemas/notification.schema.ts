import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationChannel {
  Email = 'email',
}

export enum NotificationStatus {
  Sent = 'sent',
  Failed = 'failed',
  Skipped = 'skipped',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ required: true, enum: NotificationChannel })
  channel: NotificationChannel;

  @Prop({ required: true })
  event: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true, enum: NotificationStatus })
  status: NotificationStatus;

  @Prop()
  error?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
