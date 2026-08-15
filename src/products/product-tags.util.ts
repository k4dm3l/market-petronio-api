import { BadRequestException } from '@nestjs/common';

const MAX_TAGS = 10;

/** Spec 004 — lowercase + hyphenate; reject empties; max 10; unique */
export function normalizeProductTags(raw: string[] | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException('tags must be an array of strings');
  }
  if (raw.length > MAX_TAGS) {
    throw new BadRequestException(`tags cannot exceed ${MAX_TAGS} items`);
  }

  const normalized = raw.map((tag, index) => {
    if (typeof tag !== 'string') {
      throw new BadRequestException(`tags[${index}] must be a string`);
    }
    const value = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!value) {
      throw new BadRequestException('tags cannot contain empty strings');
    }
    return value;
  });

  return [...new Set(normalized)];
}

/** Parse `tags=seafood,shrimp` query into normalized list (AND semantics). */
export function parseTagsQuery(tags?: string): string[] {
  if (!tags?.trim()) return [];
  return normalizeProductTags(
    tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  );
}
