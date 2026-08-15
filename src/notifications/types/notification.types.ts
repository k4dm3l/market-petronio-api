export type NotificationEvent =
  | 'user.created'
  | 'password.recovery'
  | 'role.updated'
  | 'order.created'
  | 'order.status_updated'
  | 'payment.status_updated'
  | 'shipping.status_updated'
  | 'order.received'
  | 'user.status_updated'
  | 'product.status_updated';

export type OrderNotificationContext = {
  orderId: string;
  orderNumber: string;
  cookName: string;
  customerName: string;
  itemsHtml: string;
  totalFormatted: string;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  carrier?: string;
  trackingNumber?: string;
};
