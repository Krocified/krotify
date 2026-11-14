import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchLrclibLyrics,
  resetLrclibState,
  LrclibError,
  LrclibRateLimitError,
  type LrclibFetch,
  type LrclibLyrics,
  type LrclibResponse,
} from '../src/library/lrclib.ts';

const input = {
  trackId: 'track-1',
  title: 'Song',
  artist: 'Artist',
  album: 'Album',
  durationMs: 200_000,
};

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): LrclibResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

function baseOptions(overrides: Partial<Parameters<typeof fetchLrclibLyrics>[1]> = {}) {
  return {
    now: () => 1_000,
    sleep: async () => {},
    spacingMs: () => 0,
    timeoutMs: 1_000,
    version: '1.2.3',
    isWeb: false,
    ...overrides,
  };
}

function memoryCache(initial: [string, LrclibLyrics][] = []) {
  const store = new Map(initial);
  return {
    store,
    cache: {
      get: async (trackId: string) => store.get(trackId) ?? null,
      put: async (trackId: string, lyrics: LrclibLyrics) => {
        store.set(trackId, lyrics);
      },
    },
  };
}

test('spaces sequential requests by at least 200ms', async () => {
  resetLrclibState();
  const sleeps: number[] = [];
  let clock = 0;
  const fetchFn: LrclibFetch = async () => response(404, {});
  const options = baseOptions({
    fetch: fetchFn,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    spacingMs: () => 200,
  });

  await fetchLrclibLyrics({ ...input, trackId: undefined }, options);
  await fetchLrclibLyrics({ ...input, trackId: undefined }, options);
  await fetchLrclibLyrics({ ...input, trackId: undefined }, options);

  assert.deepEqual(sleeps, [200, 200]);
});

test('a request queued behind a 429 waits out the Retry-After window', async () => {
  resetLrclibState();
  let resolveFirst: (value: LrclibResponse) => void = () => {};
  const first = new Promise<LrclibResponse>((resolve) => {
    resolveFirst = resolve;
  });
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    if (calls === 1) return first;
    throw new Error('queued request reached the network');
  };
  const options = baseOptions({ fetch: fetchFn });
  const noTrack = { ...input, trackId: undefined };

  const firstCall = fetchLrclibLyrics(noTrack, options);
  const queuedCall = fetchLrclibLyrics(noTrack, options);
  const firstCheck = assert.rejects(
    firstCall,
    (error: unknown) => error instanceof LrclibRateLimitError && error.retryAfterMs === 5_000,
  );
  const queuedCheck = assert.rejects(
    queuedCall,
    (error: unknown) => error instanceof LrclibRateLimitError && error.retryAfterMs === 5_000,
  );

  resolveFirst(response(429, {}, { 'retry-after': '5' }));
  await Promise.all([firstCheck, queuedCheck]);

  assert.equal(calls, 1);
});

test('accepts a duration within two seconds and rejects a larger gap', async () => {
  resetLrclibState();
  const within: LrclibFetch = async () =>
    response(200, { duration: 202, syncedLyrics: '[00:01.00]Near' });
  const near = await fetchLrclibLyrics(
    { ...input, trackId: undefined },
    baseOptions({ fetch: within }),
  );
  assert.deepEqual(near, { kind: 'synced', text: '[00:01.00]Near' });

  resetLrclibState();
  const short: LrclibFetch = async () =>
    response(200, { duration: 198, syncedLyrics: '[00:01.00]Near' });
  const nearShort = await fetchLrclibLyrics(
    { ...input, trackId: undefined },
    baseOptions({ fetch: short }),
  );
  assert.deepEqual(nearShort, { kind: 'synced', text: '[00:01.00]Near' });

  resetLrclibState();
  const outside: LrclibFetch = async () =>
    response(200, { duration: 203, syncedLyrics: '[00:01.00]Far' });
  const far = await fetchLrclibLyrics(
    { ...input, trackId: undefined },
    baseOptions({ fetch: outside }),
  );
  assert.deepEqual(far, { kind: 'none' });
});

test('caches a successful lookup and serves it without fetching', async () => {
  resetLrclibState();
  const { store, cache } = memoryCache();
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    return response(200, { duration: 200, syncedLyrics: '[00:01.00]Hello' });
  };

  const first = await fetchLrclibLyrics(input, baseOptions({ fetch: fetchFn, cache }));
  assert.deepEqual(first, { kind: 'synced', text: '[00:01.00]Hello' });
  assert.deepEqual(store.get(input.trackId), first);
  assert.equal(calls, 1);

  const second = await fetchLrclibLyrics(
    input,
    baseOptions({
      cache,
      fetch: async () => {
        throw new Error('cache hit should not fetch');
      },
    }),
  );
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('caches a 404 as none and serves it without fetching', async () => {
  resetLrclibState();
  const { store, cache } = memoryCache();
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    return response(404, {});
  };

  const first = await fetchLrclibLyrics(input, baseOptions({ fetch: fetchFn, cache }));
  assert.deepEqual(first, { kind: 'none' });
  assert.deepEqual(store.get(input.trackId), { kind: 'none' });
  assert.equal(calls, 1);

  const second = await fetchLrclibLyrics(
    input,
    baseOptions({
      cache,
      fetch: async () => {
        throw new Error('cache hit should not fetch');
      },
    }),
  );
  assert.deepEqual(second, { kind: 'none' });
  assert.equal(calls, 1);
});

test('times out a stalled request so later lookups can proceed', async () => {
  resetLrclibState();
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    if (calls === 1) return new Promise<LrclibResponse>(() => {});
    return response(404, {});
  };
  const options = baseOptions({ fetch: fetchFn, timeoutMs: 20 });

  await assert.rejects(
    fetchLrclibLyrics({ ...input, trackId: undefined }, options),
    (error: unknown) => error instanceof LrclibError && error.code === 'timeout',
  );

  const next = await fetchLrclibLyrics({ ...input, trackId: undefined }, options);
  assert.deepEqual(next, { kind: 'none' });
  assert.equal(calls, 2);
});
