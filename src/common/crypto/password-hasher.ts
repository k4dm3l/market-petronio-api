import { hash, verify } from '@node-rs/argon2';

/** Spec 002 — Argon2id password hashing (default algorithm in @node-rs/argon2) */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}
