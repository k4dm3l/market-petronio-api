import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EMAIL_SENDER,
  EmailSender,
} from './email/email-sender.interface';
import {
  Notification,
  NotificationChannel,
  NotificationDocument,
  NotificationStatus,
} from './schemas/notification.schema';

export type OrderEmailEvent =
  | 'order.created'
  | 'order.confirmed'
  | 'order.payment_paid'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.customer_confirmed';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async notifyUser(params: {
    userId: string;
    email: string;
    orderId?: string;
    event: OrderEmailEvent;
    subject: string;
    html: string;
  }) {
    let status = NotificationStatus.Sent;
    let error: string | undefined;

    try {
      await this.emailSender.send({
        to: params.email,
        subject: params.subject,
        html: params.html,
      });
    } catch (err) {
      status = NotificationStatus.Failed;
      error = err instanceof Error ? err.message : 'Unknown email error';
      this.logger.error(`Failed to send ${params.event}: ${error}`);
    }

    await this.notificationModel.create({
      userId: new Types.ObjectId(params.userId),
      orderId: params.orderId
        ? new Types.ObjectId(params.orderId)
        : undefined,
      channel: NotificationChannel.Email,
      event: params.event,
      subject: params.subject,
      body: params.html,
      status,
      error,
    });
  }

  async listForUser(userId: string) {
    const rows = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    return rows.map((n) => ({
      id: n.id,
      orderId: n.orderId?.toString(),
      channel: n.channel,
      event: n.event,
      subject: n.subject,
      status: n.status,
      error: n.error,
      createdAt: (n as { createdAt?: Date }).createdAt,
    }));
  }
}
