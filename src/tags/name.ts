export const TAG_NAME_MAX = 32;

export function normalizeTagName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || name.length > TAG_NAME_MAX) return null;
  return name;
}
