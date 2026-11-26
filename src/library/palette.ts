import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'krotify.palette.v1';
const CACHE_LIMIT = 200;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type PaletteReader = { dominantColor(uri: string): Promise<string | null> };

type PaletteCache = Record<string, string>;

let memoryCache: PaletteCache | null = null;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export async function readCoverColor(
  uri: string,
  reader?: PaletteReader,
): Promise<string | null> {
  if (!reader) return null;
  try {
    const color = await reader.dominantColor(uri);
    return typeof color === 'string' && isHexColor(color) ? color : null;
  } catch {
    return null;
  }
}

async function loadCache(): Promise<PaletteCache> {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      memoryCache = {};
      return memoryCache;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      memoryCache = {};
      return memoryCache;
    }
    const cache: PaletteCache = {};
    for (const [uri, color] of Object.entries(parsed)) {
      if (typeof color === 'string' && isHexColor(color)) cache[uri] = color;
    }
    memoryCache = cache;
    return cache;
  } catch {
    memoryCache = {};
    return memoryCache;
  }
}

async function saveCache(cache: PaletteCache): Promise<void> {
  const entries = Object.entries(cache).slice(0, CACHE_LIMIT);
  memoryCache = Object.fromEntries(entries);
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
  }
}

async function isWeb(): Promise<boolean> {
  try {
    const { Platform } = await import('react-native');
    return Platform.OS === 'web';
  } catch {
    return false;
  }
}

export async function getCoverColor(uri: string | undefined): Promise<string | null> {
  if (!uri || (await isWeb())) return null;

  try {
    const cache = await loadCache();
    const cached = cache[uri];
    if (cached) return cached;

    const paletteModule = await import('../../modules/ambient-palette');
    const color = await readCoverColor(uri, paletteModule);
    if (!color) return null;

    await saveCache({ [uri]: color, ...cache });
    return color;
  } catch {
    return null;
  }
}

export async function clearPaletteCache(): Promise<void> {
  memoryCache = null;
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
  }
}
