import type { CachedLyrics, LyricsKind } from '../db/repo';

export const LRCLIB_BASE = 'https://lrclib.net';
export const LRCLIB_URL = 'https://github.com/Krocified/krotify';
export const DURATION_TOLERANCE_MS = 2_000;

export type LrclibLyrics = CachedLyrics;

export type LrclibInput = {
  trackId?: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
};

export type LrclibCache = {
  get(trackId: string): Promise<LrclibLyrics | null>;
  put(trackId: string, lyrics: LrclibLyrics): Promise<void>;
};

export type LrclibResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

export type LrclibFetch = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<LrclibResponse>;

export type LrclibOptions = {
  fetch?: LrclibFetch;
  cache?: LrclibCache;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  version?: string;
  isWeb?: boolean;
  spacingMs?: () => number;
  baseUrl?: string;
};

export type LrclibErrorCode = 'network' | 'http' | 'rate-limit' | 'invalid-response';

export class LrclibError extends Error {
  readonly code: LrclibErrorCode;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    code: LrclibErrorCode,
    message: string,
    details: { status?: number; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = 'LrclibError';
    this.code = code;
    this.status = details.status;
    this.retryAfterMs = details.retryAfterMs;
  }
}

export class LrclibRateLimitError extends LrclibError {
  constructor(retryAfterMs: number) {
    super('rate-limit', `LRCLIB rate limited; retry in ${retryAfterMs}ms`, {
      status: 429,
      retryAfterMs,
    });
    this.name = 'LrclibRateLimitError';
  }
}

const DEFAULT_RETRY_AFTER_MS = 1_000;
const MIN_SPACING_MS = 200;
const SPACING_RANGE_MS = 300;

let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = Number.NEGATIVE_INFINITY;
let rateLimitedUntil = 0;

export function resetLrclibState(): void {
  requestChain = Promise.resolve();
  lastRequestAt = Number.NEGATIVE_INFINITY;
  rateLimitedUntil = 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLyricsKind(value: string): value is LyricsKind {
  return value === 'synced' || value === 'plain' || value === 'instrumental' || value === 'none';
}

function defaultVersion(): string {
  try {
    if (typeof require !== 'function') return '0.0.0';
    const app = require('../../app.json') as { expo?: { version?: string } };
    return app.expo?.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function defaultIsWeb(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function defaultSpacing(): number {
  return MIN_SPACING_MS + Math.floor(Math.random() * (SPACING_RANGE_MS + 1));
}

function buildHeaders(version: string, isWeb: boolean): Record<string, string> {
  const userAgent = `Krotify ${version} (${LRCLIB_URL})`;
  return isWeb ? { 'X-User-Agent': userAgent } : { 'User-Agent': userAgent };
}

function buildUrl(baseUrl: string, input: LrclibInput): string {
  const params = new URLSearchParams({
    track_name: input.title,
    artist_name: input.artist,
    album_name: input.album,
    duration: String(Math.round(input.durationMs / 1_000)),
  });
  return `${baseUrl}/api/get?${params.toString()}`;
}

function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return undefined;
}

async function resolveCache(options: LrclibOptions): Promise<LrclibCache | null> {
  if (options.cache) return options.cache;
  try {
    const repo = await import('../db/repo');
    return {
      get: (trackId) => repo.getCachedLyrics(trackId),
      put: (trackId, lyrics) => repo.putCachedLyrics(trackId, lyrics),
    };
  } catch {
    return null;
  }
}

function mapResponse(data: unknown, input: LrclibInput): LrclibLyrics {
  if (!isRecord(data)) {
    throw new LrclibError('invalid-response', 'LRCLIB returned an unexpected payload');
  }

  const duration = data.duration;
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    if (Math.abs(duration * 1_000 - input.durationMs) > DURATION_TOLERANCE_MS) {
      return { kind: 'none' };
    }
  }

  if (data.instrumental === true) return { kind: 'instrumental' };

  const synced = typeof data.syncedLyrics === 'string' ? data.syncedLyrics.trim() : '';
  if (synced) return { kind: 'synced', text: synced };

  const plain = typeof data.plainLyrics === 'string' ? data.plainLyrics.trim() : '';
  if (plain) return { kind: 'plain', text: plain };

  return { kind: 'none' };
}

function schedule<T>(
  task: () => Promise<T>,
  now: () => number,
  sleep: (ms: number) => Promise<void>,
  spacingMs: () => number,
): Promise<T> {
  const run = requestChain.then(async () => {
    const wait = Math.max(0, lastRequestAt + spacingMs() - now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
    return task();
  });
  requestChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function fetchLrclibLyrics(
  input: LrclibInput,
  options: LrclibOptions = {},
): Promise<LrclibLyrics> {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const spacingMs = options.spacingMs ?? defaultSpacing;
  const baseUrl = options.baseUrl ?? LRCLIB_BASE;
  const doFetch: LrclibFetch =
    options.fetch ??
    ((url, init) => fetch(url, { headers: init.headers }) as unknown as Promise<LrclibResponse>);

  const cache = input.trackId ? await resolveCache(options) : null;
  if (cache && input.trackId) {
    const cached = await cache.get(input.trackId).catch(() => null);
    if (cached && isLyricsKind(cached.kind)) return cached;
  }

  const blockedFor = rateLimitedUntil - now();
  if (blockedFor > 0) throw new LrclibRateLimitError(blockedFor);

  const result = await schedule(
    async () => {
      let response: LrclibResponse;
      try {
        response = await doFetch(buildUrl(baseUrl, input), {
          headers: buildHeaders(options.version ?? defaultVersion(), options.isWeb ?? defaultIsWeb()),
        });
      } catch {
        throw new LrclibError('network', 'Unable to reach LRCLIB');
      }

      if (response.status === 404) return { kind: 'none' } as LrclibLyrics;

      if (response.status === 429) {
        const retryAfterMs =
          parseRetryAfter(response.headers.get('retry-after'), now()) ?? DEFAULT_RETRY_AFTER_MS;
        rateLimitedUntil = Math.max(rateLimitedUntil, now() + retryAfterMs);
        throw new LrclibRateLimitError(retryAfterMs);
      }

      if (!response.ok) {
        throw new LrclibError('http', `LRCLIB request failed with ${response.status}`, {
          status: response.status,
        });
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new LrclibError('invalid-response', 'LRCLIB returned invalid JSON');
      }

      return mapResponse(data, input);
    },
    now,
    sleep,
    spacingMs,
  );

  if (cache && input.trackId) {
    await cache.put(input.trackId, result).catch(() => undefined);
  }

  return result;
}
