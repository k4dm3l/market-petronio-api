import { createHash, randomInt } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { hashPassword } from '../common/crypto/password-hasher';
import { NotificationsService } from '../notifications/notifications.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
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
    private readonly notificationsService: NotificationsService,
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

    const sent = await this.notificationsService.notifyPasswordRecovery({
      userId: user.id,
      email: user.email,
      otp,
    });

    if (!sent) {
      this.logger.error(
        `Failed to send recovery OTP for userId=${user.id}`,
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
