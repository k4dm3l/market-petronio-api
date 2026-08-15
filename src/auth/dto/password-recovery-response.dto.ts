import { ApiProperty } from '@nestjs/swagger';

export class PasswordRecoveryRequestResponseDto {
  @ApiProperty({
    example:
      'If an account exists with this email, a recovery code has been sent.',
    description:
      'Always the same generic message (does not reveal whether the email is registered).',
  })
  message: string;
}

export class PasswordRecoveryResetResponseDto {
  @ApiProperty({ example: 'Password updated successfully' })
  message: string;
}
