async function openDb() {
  const { getDb } = await import('./index');
  return getDb();
}

export type ScanSummary = {
  lastScanAt: number;
  found: number;
  newTracks: number;
  missing: number;
};

export async function getSetting(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function putSetting(key: string, value: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value,
  );
}

function storedNumber(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseScanSummary(
  values: Record<string, string | null>,
): ScanSummary | null {
  const lastScanAt = storedNumber(values['scan.lastScanAt'] ?? null);
  const found = storedNumber(values['scan.found'] ?? null);
  const newTracks = storedNumber(values['scan.new'] ?? null);
  const missing = storedNumber(values['scan.missing'] ?? null);

  if (
    lastScanAt === null ||
    found === null ||
    newTracks === null ||
    missing === null
  ) {
    return null;
  }

  return { lastScanAt, found, newTracks, missing };
}

export async function getScanSummary(): Promise<ScanSummary | null> {
  const [lastScanAt, found, newTracks, missing] = await Promise.all([
    getSetting('scan.lastScanAt'),
    getSetting('scan.found'),
    getSetting('scan.new'),
    getSetting('scan.missing'),
  ]);
  return parseScanSummary({
    'scan.lastScanAt': lastScanAt,
    'scan.found': found,
    'scan.new': newTracks,
    'scan.missing': missing,
  });
}

export async function putScanSummary(summary: ScanSummary): Promise<void> {
  await putSetting('scan.lastScanAt', String(summary.lastScanAt));
  await putSetting('scan.found', String(summary.found));
  await putSetting('scan.new', String(summary.newTracks));
  await putSetting('scan.missing', String(summary.missing));
}
