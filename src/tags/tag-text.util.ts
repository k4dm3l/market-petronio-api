import { BadRequestException } from '@nestjs/common';

const MAX_TAG_LENGTH = 50;

/**
 * Spec 009 — trim, lowercase, collapse whitespace to hyphen, max 50.
 * Shared by tag catalog and product.tags string identifiers.
 */
export function normalizeTagText(raw: string): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('Tag text must be a string');
  }
  const text = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (!text) {
    throw new BadRequestException('Tag text cannot be empty');
  }
  if (text.length > MAX_TAG_LENGTH) {
    throw new BadRequestException(
      `Tag text cannot exceed ${MAX_TAG_LENGTH} characters`,
    );
  }
  return text;
}
