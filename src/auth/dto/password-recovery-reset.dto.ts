import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsStrongPassword,
  PASSWORD_MESSAGE,
} from '../../common/validators/password.validator';

export class PasswordRecoveryResetDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Same email used in the recovery request',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482913',
    description: '6-digit OTP received by email (valid for 10 minutes)',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({
    example: 'Password123!',
    description: PASSWORD_MESSAGE,
    minLength: 8,
  })
  @IsString()
  @IsStrongPassword()
  newPassword: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Must match newPassword exactly',
    minLength: 8,
  })
  @IsString()
  @IsStrongPassword()
  confirmPassword: string;
}
