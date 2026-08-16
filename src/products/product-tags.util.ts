import { BadRequestException } from '@nestjs/common';
import { normalizeTagText } from '../tags/tag-text.util';

const MAX_TAGS = 10;

/** Spec 004/009 — normalize via tag catalog rules; max 10; unique */
export function normalizeProductTags(raw: string[] | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException('tags must be an array of strings');
  }
  if (raw.length > MAX_TAGS) {
    throw new BadRequestException(`tags cannot exceed ${MAX_TAGS} items`);
  }

  const normalized = raw.map((tag, index) => {
    try {
      return normalizeTagText(tag);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw new BadRequestException(`tags[${index}]: ${err.message}`);
      }
      throw err;
    }
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
