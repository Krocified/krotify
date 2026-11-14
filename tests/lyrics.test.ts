import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLyrics } from '../src/library/lyrics.ts';
import { resetLrclibState, type LrclibFetch, type LrclibLyrics } from '../src/library/lrclib.ts';
import type { Track } from '../src/types.ts';

const track: Track = {
  id: 'track-1',
  uri: 'file:///music/song.mp3',
  source: 'scan',
  title: 'Song',
  artist: 'Artist',
  album: 'Album',
  durationMs: 200_000,
  artworkHue: 0,
};

function memoryCache(initial: [string, LrclibLyrics][] = []) {
  const store = new Map(initial);
  return {
    get: async (trackId: string) => store.get(trackId) ?? null,
    put: async (trackId: string, lyrics: LrclibLyrics) => {
      store.set(trackId, lyrics);
    },
  };
}

test('allowNetwork false serves cached lyrics without fetching', async () => {
  resetLrclibState();
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    throw new Error('network lookup should be skipped');
  };

  const result = await loadLyrics(track, {
    allowNetwork: false,
    findFile: async () => null,
    lrclib: {
      fetch: fetchFn,
      cache: memoryCache([[track.id, { kind: 'synced', text: '[00:01.00]Hello' }]]),
      now: () => 1_000,
      sleep: async () => {},
      spacingMs: () => 0,
      version: '1.2.3',
      isWeb: false,
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.kind, 'synced');
  assert.equal(result.source, 'lrclib');
  assert.deepEqual(result.lines, [{ atMs: 1_000, text: 'Hello' }]);
});

test('allowNetwork false without a cache hit returns none without fetching', async () => {
  resetLrclibState();
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    throw new Error('network lookup should be skipped');
  };

  const result = await loadLyrics(track, {
    allowNetwork: false,
    findFile: async () => null,
    lrclib: { fetch: fetchFn, cache: memoryCache() },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, { kind: 'none', lines: [], offsetMs: 0, source: undefined });
});

test('a sidecar is still read when network lookup is disabled', async () => {
  resetLrclibState();
  let calls = 0;
  const fetchFn: LrclibFetch = async () => {
    calls += 1;
    throw new Error('network lookup should be skipped');
  };

  const result = await loadLyrics(track, {
    allowNetwork: false,
    findFile: async () => 'file:///music/song.lrc',
    readFile: async () => '[00:02.00]Local',
    lrclib: { fetch: fetchFn, cache: memoryCache() },
  });

  assert.equal(calls, 0);
  assert.equal(result.kind, 'synced');
  assert.equal(result.source, 'sidecar');
  assert.deepEqual(result.lines, [{ atMs: 2_000, text: 'Local' }]);
});
