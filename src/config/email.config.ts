import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  platformUrl: process.env.PLATFORM_URL ?? 'http://localhost:5173',
}));
