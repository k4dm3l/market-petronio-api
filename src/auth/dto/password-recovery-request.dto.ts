import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordRecoveryRequestDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Registered account email that will receive the 6-digit OTP',
    format: 'email',
  })
  @IsEmail()
  email: string;
}
