export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export class SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export abstract class EmailSender {
  abstract send(params: SendEmailParams): Promise<void>;
}
