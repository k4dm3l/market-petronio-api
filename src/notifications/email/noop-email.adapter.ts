import { Logger } from '@nestjs/common';
import { EmailSender, SendEmailParams } from './email-sender.interface';

/** Used when Resend is not configured — logs instead of sending. */
export class NoOpEmailAdapter extends EmailSender {
  private readonly logger = new Logger(NoOpEmailAdapter.name);

  async send(params: SendEmailParams): Promise<void> {
    this.logger.log(
      `[noop-email] to=${params.to} subject=${params.subject}`,
    );
  }
}
