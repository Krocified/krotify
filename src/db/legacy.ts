export type LegacyImport = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  durationMs: number;
  artworkHue?: number;
};

export type LegacyExcluded = { id: string };

function parseArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asRecord(item: unknown): Record<string, unknown> | null {
  if (typeof item !== 'object' || item === null) return null;
  return item as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseLegacyImports(raw: string | null): LegacyImport[] {
  const imports: LegacyImport[] = [];
  for (const item of parseArray(raw)) {
    const record = asRecord(item);
    if (!record) continue;
    if (record.source !== 'import') continue;
    if (typeof record.id !== 'string') continue;
    if (typeof record.uri !== 'string' || record.uri.length === 0) continue;
    const artworkHue = finiteNumber(record.artworkHue);
    imports.push({
      id: record.id,
      uri: record.uri,
      title: typeof record.title === 'string' ? record.title : '',
      artist: typeof record.artist === 'string' ? record.artist : '',
      durationMs: finiteNumber(record.durationMs) ?? 0,
      ...(artworkHue === null ? {} : { artworkHue }),
    });
  }
  return imports;
}

export function parseLegacyExcluded(raw: string | null): LegacyExcluded[] {
  const excluded: LegacyExcluded[] = [];
  for (const item of parseArray(raw)) {
    const record = asRecord(item);
    if (record && typeof record.id === 'string') excluded.push({ id: record.id });
  }
  return excluded;
}
