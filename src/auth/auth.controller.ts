import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiBadRequestResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordRecoveryRequestDto } from './dto/password-recovery-request.dto';
import { PasswordRecoveryResetDto } from './dto/password-recovery-reset.dto';
import {
  PasswordRecoveryRequestResponseDto,
  PasswordRecoveryResetResponseDto,
} from './dto/password-recovery-response.dto';
import { PromoteAdminDto } from './dto/promote-admin.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PasswordRecoveryService } from './password-recovery.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login and receive access + refresh tokens' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-recovery/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password recovery OTP',
    description: `
Sends a 6-digit OTP to the registered email when the account exists.

**Security**
- Response is always the same generic message (no email enumeration).
- OTP is stored hashed in Redis with a **10-minute** TTL.
- Max **3** recovery requests per email every **15 minutes**.
- IP rate limit: **5** requests / minute (in addition to per-email Redis limit).

**Flow**
1. Call this endpoint with the account email.
2. User receives the OTP by email.
3. Call \`POST /auth/password-recovery/reset\` with OTP + new password.
    `.trim(),
  })
  @ApiBody({ type: PasswordRecoveryRequestDto })
  @ApiOkResponse({
    description: 'Generic acknowledgment (sent whether or not the email exists)',
    type: PasswordRecoveryRequestResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid email format',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  requestPasswordRecovery(@Body() dto: PasswordRecoveryRequestDto) {
    return this.passwordRecoveryService.request(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password-recovery/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with email OTP',
    description: `
Validates the OTP from Redis and updates the password (Argon2id).

**Validations**
- Email must belong to an active user with a pending OTP
- \`newPassword\` === \`confirmPassword\`
- Password rules: min 8 chars, uppercase, lowercase, number, special character
- OTP not expired (10 min) and not over attempt limit (**5** tries)

On success the Redis recovery key is deleted so the OTP cannot be reused.
    `.trim(),
  })
  @ApiBody({ type: PasswordRecoveryResetDto })
  @ApiOkResponse({
    description: 'Password updated',
    type: PasswordRecoveryResetResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid/expired OTP, passwords do not match, weak password, or too many attempts',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid or expired recovery code',
        error: 'Bad Request',
      },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  resetPassword(@Body() dto: PasswordRecoveryResetDto) {
    return this.passwordRecoveryService.reset(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.Admin)
  @Post('promote-admin')
  @ApiOperation({
    summary: 'Promote an existing user to admin (admin only)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token' })
  promoteAdmin(
    @CurrentUser() actor: AuthUser,
    @Body() dto: PromoteAdminDto,
  ) {
    return this.authService.promoteToAdmin(actor, dto.userId);
  }
}
