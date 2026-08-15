import { applyDecorators } from '@nestjs/common';
import { Matches, MinLength } from 'class-validator';

/** Spec 002 — shared registration + password-recovery rules */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

export function IsStrongPassword() {
  return applyDecorators(
    MinLength(8, { message: PASSWORD_MESSAGE }),
    Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE }),
  );
}
