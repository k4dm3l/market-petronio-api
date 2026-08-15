import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailSender, SendEmailParams } from './email-sender.interface';

export class ResendEmailAdapter extends EmailSender {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    super();
    this.client = new Resend(apiKey);
  }

  async send(params: SendEmailParams): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      this.logger.error(`Resend failed: ${error.message}`);
      throw new Error(error.message);
    }
  }
}
