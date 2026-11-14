import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCAN_PREF_KEY = 'krotify.scanEnabled.v1';

export type ScanPrefStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function parseScanPref(raw: string | null | undefined): boolean {
  return raw === 'true';
}

export function serializeScanPref(enabled: boolean): string {
  return enabled ? 'true' : 'false';
}

export async function loadScanPref(storage: ScanPrefStorage = AsyncStorage): Promise<boolean> {
  try {
    return parseScanPref(await storage.getItem(SCAN_PREF_KEY));
  } catch {
    return false;
  }
}

export async function readScanPref(
  storage: ScanPrefStorage = AsyncStorage,
): Promise<boolean | null> {
  try {
    const raw = await storage.getItem(SCAN_PREF_KEY);
    return raw === null ? null : parseScanPref(raw);
  } catch {
    return null;
  }
}

export async function saveScanPref(
  enabled: boolean,
  storage: ScanPrefStorage = AsyncStorage,
): Promise<void> {
  await storage.setItem(SCAN_PREF_KEY, serializeScanPref(enabled));
}
