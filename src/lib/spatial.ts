import AsyncStorage from '@react-native-async-storage/async-storage';

export const SPATIAL_KEY = 'krotify.spatial.v1';
export const SPATIAL_MODES = ['off', 'low', 'medium', 'high'] as const;
export type SpatialMode = (typeof SPATIAL_MODES)[number];

const STRENGTH: Record<SpatialMode, number> = { off: 0, low: 400, medium: 700, high: 1000 };
const LABELS: Record<SpatialMode, string> = { off: 'Off', low: 'Low', medium: 'Medium', high: 'High' };

export type SpatialStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function parseSpatialMode(raw: string | null | undefined): SpatialMode {
  return SPATIAL_MODES.includes(raw as SpatialMode) ? (raw as SpatialMode) : 'off';
}

export function serializeSpatialMode(mode: SpatialMode): string {
  return mode;
}

export function spatialStrength(mode: SpatialMode): number {
  return STRENGTH[mode];
}

export function spatialRequest(mode: SpatialMode): { enabled: boolean; strength: number } {
  return { enabled: mode !== 'off', strength: spatialStrength(mode) };
}

export function spatialModeLabel(mode: SpatialMode): string {
  return LABELS[mode];
}

export function spatialNote(supported: boolean | null): string | null {
  return supported === false ? 'Not supported on this device' : null;
}

export function shouldFallbackSpatial(mode: SpatialMode, supported: boolean | null): boolean {
  return supported === false && mode !== 'off';
}

export async function loadSpatialMode(
  storage: SpatialStorage = AsyncStorage,
): Promise<SpatialMode> {
  try {
    return parseSpatialMode(await storage.getItem(SPATIAL_KEY));
  } catch {
    return 'off';
  }
}

export async function saveSpatialMode(
  mode: SpatialMode,
  storage: SpatialStorage = AsyncStorage,
): Promise<void> {
  await storage.setItem(SPATIAL_KEY, serializeSpatialMode(mode));
}
