import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    example: 'Password123!',
    description:
      'Min 8 chars, uppercase, lowercase, number, and special character',
  })
  @IsString()
  @IsStrongPassword()
  password: string;
}
