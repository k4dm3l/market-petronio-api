import { createHash, randomInt } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { hashPassword } from '../common/crypto/password-hasher';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  EMAIL_SENDER,
  EmailSender,
} from '../notifications/email/email-sender.interface';
import { UsersService } from '../users/users.service';

const OTP_TTL_SECONDS = 600; // 10 minutes
const REQUEST_WINDOW_SECONDS = 900; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_OTP_ATTEMPTS = 5;

type RecoveryPayload = {
  otpHash: string;
  attempts: number;
};

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly usersService: UsersService,
  ) {}

  async request(email: string) {
    const generic = {
      message:
        'If an account exists with this email, a recovery code has been sent.',
    };

    const normalized = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalized);
    if (!user || !user.isActive) {
      return generic;
    }

    const rateKey = `password-recovery:rl:request:${normalized}`;
    const requests = await this.redis.incr(rateKey);
    if (requests === 1) {
      await this.redis.expire(rateKey, REQUEST_WINDOW_SECONDS);
    }
    if (requests > MAX_REQUESTS_PER_WINDOW) {
      // Still generic — do not reveal rate limit details that confirm the account
      return generic;
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = this.hashOtp(otp);
    const recoveryKey = `password-recovery:${user.id}`;
    const payload: RecoveryPayload = { otpHash, attempts: 0 };

    await this.redis.set(
      recoveryKey,
      JSON.stringify(payload),
      'EX',
      OTP_TTL_SECONDS,
    );

    try {
      await this.emailSender.send({
        to: user.email,
        subject: 'Password recovery code',
        html: `<p>Your recovery code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
        text: `Your recovery code is ${otp}. It expires in 10 minutes.`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send recovery OTP: ${err instanceof Error ? err.message : err}`,
      );
      await this.redis.del(recoveryKey);
    }

    return generic;
  }

  async reset(params: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (params.newPassword !== params.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.usersService.findByEmail(params.email);
    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid recovery code or email');
    }

    const recoveryKey = `password-recovery:${user.id}`;
    const raw = await this.redis.get(recoveryKey);
    if (!raw) {
      throw new BadRequestException('Invalid or expired recovery code');
    }

    let payload: RecoveryPayload;
    try {
      payload = JSON.parse(raw) as RecoveryPayload;
    } catch {
      await this.redis.del(recoveryKey);
      throw new BadRequestException('Invalid or expired recovery code');
    }

    if (payload.attempts >= MAX_OTP_ATTEMPTS) {
      await this.redis.del(recoveryKey);
      throw new BadRequestException('Too many invalid attempts');
    }

    const otpHash = this.hashOtp(params.otp);
    if (otpHash !== payload.otpHash) {
      payload.attempts += 1;
      const ttl = await this.redis.ttl(recoveryKey);
      if (payload.attempts >= MAX_OTP_ATTEMPTS) {
        await this.redis.del(recoveryKey);
        throw new BadRequestException('Too many invalid attempts');
      }
      await this.redis.set(
        recoveryKey,
        JSON.stringify(payload),
        'EX',
        ttl > 0 ? ttl : OTP_TTL_SECONDS,
      );
      throw new BadRequestException('Invalid or expired recovery code');
    }

    const passwordHash = await hashPassword(params.newPassword);
    await this.usersService.updatePassword(user.id, passwordHash);
    await this.redis.del(recoveryKey);

    return { message: 'Password updated successfully' };
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }
}
