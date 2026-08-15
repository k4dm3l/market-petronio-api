import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EMAIL_SENDER, EmailSender } from './email/email-sender.interface';
import { EmailTemplatesService } from './email/email-templates.service';
import {
  Notification,
  NotificationChannel,
  NotificationDocument,
  NotificationStatus,
} from './schemas/notification.schema';
import {
  NotificationEvent,
  OrderNotificationContext,
} from './types/notification.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private readonly templates: EmailTemplatesService,
  ) {}

  async notifyUserRegistered(params: {
    userId: string;
    email: string;
    userName: string;
  }) {
    const html = this.templates.render(
      'user-created',
      'Welcome to Market Petronio',
      { userName: params.userName },
      {
        label: 'Go to the platform',
        url: this.templates.platformUrl,
      },
    );
    await this.dispatch({
      userId: params.userId,
      email: params.email,
      event: 'user.created',
      subject: 'Welcome to Market Petronio',
      html,
    });
  }

  /** Returns false if the email failed (caller may clear OTP). */
  async notifyPasswordRecovery(params: {
    userId: string;
    email: string;
    otp: string;
  }): Promise<boolean> {
    const html = this.templates.render('password-recovery', 'Password Recovery', {
      otp: params.otp,
    });
    const status = await this.dispatch({
      userId: params.userId,
      email: params.email,
      event: 'password.recovery',
      subject: 'Password recovery code',
      html,
      text: `Your recovery code is ${params.otp}. It expires in 10 minutes.`,
    });
    return status === NotificationStatus.Sent;
  }

  async notifyRoleUpdatedToAdmin(params: {
    userId: string;
    email: string;
    userName: string;
  }) {
    const html = this.templates.render(
      'role-updated',
      'Your role has been updated',
      { userName: params.userName },
      { label: 'Go to the platform', url: this.templates.platformUrl },
    );
    await this.dispatch({
      userId: params.userId,
      email: params.email,
      event: 'role.updated',
      subject: 'Your role is now Administrator',
      html,
    });
  }

  async notifyOrderCreated(params: {
    customer: { userId: string; email: string; name: string };
    cook: { userId: string; email: string; name: string };
    ctx: OrderNotificationContext;
  }) {
    const orderUrl = `${this.templates.platformUrl}/orders/${params.ctx.orderId}`;
    const items = {
      orderNumber: params.ctx.orderNumber,
      cookName: params.ctx.cookName,
      customerName: params.ctx.customerName,
      itemsHtml: params.ctx.itemsHtml,
      totalFormatted: params.ctx.totalFormatted,
    };

    await this.dispatch({
      userId: params.customer.userId,
      email: params.customer.email,
      orderId: params.ctx.orderId,
      event: 'order.created',
      subject: `Order ${params.ctx.orderNumber} created`,
      html: this.templates.render(
        'order-created-customer',
        'Order created',
        items,
        { label: 'View my order', url: orderUrl },
      ),
    });

    await this.dispatch({
      userId: params.cook.userId,
      email: params.cook.email,
      orderId: params.ctx.orderId,
      event: 'order.created',
      subject: `New order ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'order-created-cooker',
        'New order received',
        items,
        { label: 'View order', url: orderUrl },
      ),
    });
  }

  async notifyOrderStatusUpdated(params: {
    customer: { userId: string; email: string };
    cook: { userId: string; email: string };
    ctx: OrderNotificationContext;
  }) {
    const orderUrl = `${this.templates.platformUrl}/orders/${params.ctx.orderId}`;
    const vars = {
      orderNumber: params.ctx.orderNumber,
      status: params.ctx.status ?? '',
      cookName: params.ctx.cookName,
      customerName: params.ctx.customerName,
    };

    await this.dispatch({
      userId: params.customer.userId,
      email: params.customer.email,
      orderId: params.ctx.orderId,
      event: 'order.status_updated',
      subject: `Order ${params.ctx.orderNumber} status: ${params.ctx.status}`,
      html: this.templates.render(
        'order-status-updated-customer',
        'Order status updated',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });

    await this.dispatch({
      userId: params.cook.userId,
      email: params.cook.email,
      orderId: params.ctx.orderId,
      event: 'order.status_updated',
      subject: `Order ${params.ctx.orderNumber} → ${params.ctx.status}`,
      html: this.templates.render(
        'order-status-updated-cooker',
        'Order status updated',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });
  }

  async notifyPaymentStatusUpdated(params: {
    customer: { userId: string; email: string };
    cook: { userId: string; email: string };
    ctx: OrderNotificationContext;
  }) {
    const orderUrl = `${this.templates.platformUrl}/orders/${params.ctx.orderId}`;
    const vars = {
      orderNumber: params.ctx.orderNumber,
      paymentStatus: params.ctx.paymentStatus ?? '',
      totalFormatted: params.ctx.totalFormatted,
      customerName: params.ctx.customerName,
    };

    await this.dispatch({
      userId: params.customer.userId,
      email: params.customer.email,
      orderId: params.ctx.orderId,
      event: 'payment.status_updated',
      subject: `Payment ${params.ctx.paymentStatus} — ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'payment-status-updated-customer',
        'Payment status updated',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });

    await this.dispatch({
      userId: params.cook.userId,
      email: params.cook.email,
      orderId: params.ctx.orderId,
      event: 'payment.status_updated',
      subject: `Payment ${params.ctx.paymentStatus} — ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'payment-status-updated-cooker',
        'Payment status updated',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });
  }

  async notifyShippingStatusUpdated(params: {
    customer: { userId: string; email: string };
    cook: { userId: string; email: string };
    ctx: OrderNotificationContext;
  }) {
    const orderUrl = `${this.templates.platformUrl}/orders/${params.ctx.orderId}`;
    const vars = {
      orderNumber: params.ctx.orderNumber,
      shippingStatus: params.ctx.shippingStatus ?? '',
      carrier: params.ctx.carrier || '—',
      trackingNumber: params.ctx.trackingNumber || '—',
      customerName: params.ctx.customerName,
    };

    await this.dispatch({
      userId: params.customer.userId,
      email: params.customer.email,
      orderId: params.ctx.orderId,
      event: 'shipping.status_updated',
      subject: `Shipping ${params.ctx.shippingStatus} — ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'shipping-status-updated-customer',
        'Shipping status updated',
        vars,
        { label: 'Track shipment', url: orderUrl },
      ),
    });

    await this.dispatch({
      userId: params.cook.userId,
      email: params.cook.email,
      orderId: params.ctx.orderId,
      event: 'shipping.status_updated',
      subject: `Shipping ${params.ctx.shippingStatus} — ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'shipping-status-updated-cooker',
        'Shipping status updated',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });
  }

  async notifyOrderReceived(params: {
    customer: { userId: string; email: string };
    cook: { userId: string; email: string };
    ctx: OrderNotificationContext;
  }) {
    const orderUrl = `${this.templates.platformUrl}/orders/${params.ctx.orderId}`;
    const vars = {
      orderNumber: params.ctx.orderNumber,
      customerName: params.ctx.customerName,
    };

    await this.dispatch({
      userId: params.customer.userId,
      email: params.customer.email,
      orderId: params.ctx.orderId,
      event: 'order.received',
      subject: `Reception confirmed — ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'order-received-customer',
        'Order received',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });

    await this.dispatch({
      userId: params.cook.userId,
      email: params.cook.email,
      orderId: params.ctx.orderId,
      event: 'order.received',
      subject: `Customer confirmed ${params.ctx.orderNumber}`,
      html: this.templates.render(
        'order-received-cooker',
        'Order receipt confirmed',
        vars,
        { label: 'View order', url: orderUrl },
      ),
    });
  }

  async notifyUserStatusUpdated(params: {
    userId: string;
    email: string;
    userName: string;
    isActive: boolean;
  }) {
    const statusLabel = params.isActive ? 'ACTIVATED' : 'DEACTIVATED';
    const statusMessage = params.isActive
      ? 'You can now access the platform normally.'
      : 'Please contact the platform administrator if you believe this was done incorrectly.';
    const html = this.templates.render(
      'user-status-updated',
      'Your account status has been updated',
      {
        userName: params.userName,
        statusLabel,
        statusMessage,
      },
      params.isActive
        ? { label: 'Go to the platform', url: this.templates.platformUrl }
        : undefined,
    );
    await this.dispatch({
      userId: params.userId,
      email: params.email,
      event: 'user.status_updated',
      subject: `Account ${statusLabel.toLowerCase()}`,
      html,
    });
  }

  async notifyProductStatusUpdated(params: {
    cookUserId: string;
    cookEmail: string;
    productId: string;
    productName: string;
    isActive: boolean;
  }) {
    const statusLabel = params.isActive ? 'ACTIVATED' : 'DEACTIVATED';
    const statusMessage = params.isActive
      ? 'The product is now available to customers.'
      : 'The product is no longer available for customers.';
    const html = this.templates.render(
      'product-status-updated',
      'Product status updated',
      {
        productName: params.productName,
        statusLabel,
        statusMessage,
      },
      {
        label: 'View product',
        url: `${this.templates.platformUrl}/products/${params.productId}`,
      },
    );
    await this.dispatch({
      userId: params.cookUserId,
      email: params.cookEmail,
      event: 'product.status_updated',
      subject: `Product ${statusLabel.toLowerCase()}: ${params.productName}`,
      html,
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

  private async dispatch(params: {
    userId: string;
    email: string;
    orderId?: string;
    event: NotificationEvent;
    subject: string;
    html: string;
    text?: string;
  }): Promise<NotificationStatus> {
    let status = NotificationStatus.Sent;
    let error: string | undefined;

    try {
      await this.emailSender.send({
        to: params.email,
        subject: params.subject,
        html: params.html,
        text: params.text,
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

    return status;
  }
}
