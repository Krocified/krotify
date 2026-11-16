export function normalizeLinkServerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
  } catch {
    return null;
  }

  const stripped = trimmed.replace(/\/+$/, '');
  return stripped || null;
}
