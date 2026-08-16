/** Escape special regex characters for safe case-insensitive Mongo `$regex` search. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
