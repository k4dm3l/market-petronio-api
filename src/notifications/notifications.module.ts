import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EMAIL_SENDER } from './email/email-sender.interface';
import { EmailTemplatesService } from './email/email-templates.service';
import { NoOpEmailAdapter } from './email/noop-email.adapter';
import { ResendEmailAdapter } from './email/resend-email.adapter';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailTemplatesService,
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('email.resendApiKey');
        const from = config.get<string>('email.from');
        const looksConfigured =
          !!apiKey &&
          !!from &&
          !apiKey.includes('xxxx') &&
          apiKey.startsWith('re_');

        return looksConfigured
          ? new ResendEmailAdapter(apiKey, from)
          : new NoOpEmailAdapter();
      },
    },
  ],
  exports: [NotificationsService, EMAIL_SENDER],
})
export class NotificationsModule {}
