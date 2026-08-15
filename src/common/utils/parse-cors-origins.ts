/** Comma-separated origins, e.g. `http://localhost:5173,https://app.example.com` */
export function parseCorsOrigins(
  raw: string | undefined,
  fallback = 'http://localhost:5173',
): string | string[] {
  const value = raw?.trim() || fallback;
  const list = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return list.length === 1 ? list[0]! : list;
}
