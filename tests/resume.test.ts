import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isResumeState, parseResume, serializeResume } from '../src/lib/resume.ts';
import {
  SCAN_PREF_KEY,
  loadScanPref,
  parseScanPref,
  saveScanPref,
  serializeScanPref,
} from '../src/library/scanPrefs.ts';

type MemoryStorage = {
  data: Map<string, string>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  return {
    data: new Map(Object.entries(initial)),
    async getItem(key) {
      return this.data.get(key) ?? null;
    },
    async setItem(key, value) {
      this.data.set(key, value);
    },
  };
}

test('resume state round-trips through serialize and parse', () => {
  const state = { trackId: 'track-42', positionMs: 91_500 };
  const raw = serializeResume(state);
  assert.deepEqual(parseResume(raw), state);
});

test('resume serialize normalizes position to whole milliseconds', () => {
  const raw = serializeResume({ trackId: 'track-1', positionMs: 1234.7 });
  assert.deepEqual(parseResume(raw), { trackId: 'track-1', positionMs: 1235 });
});

test('resume parse accepts zero position and drops extra fields', () => {
  const raw = JSON.stringify({ trackId: 'track-1', positionMs: 0, extra: true });
  assert.deepEqual(parseResume(raw), { trackId: 'track-1', positionMs: 0 });
});

test('resume parse returns null for missing, malformed, or invalid data', () => {
  assert.equal(parseResume(null), null);
  assert.equal(parseResume(undefined), null);
  assert.equal(parseResume(''), null);
  assert.equal(parseResume('not json'), null);
  assert.equal(parseResume('null'), null);
  assert.equal(parseResume('[]'), null);
  assert.equal(parseResume(JSON.stringify({ trackId: 'track-1' })), null);
  assert.equal(parseResume(JSON.stringify({ positionMs: 10 })), null);
  assert.equal(parseResume(JSON.stringify({ trackId: '', positionMs: 10 })), null);
  assert.equal(parseResume(JSON.stringify({ trackId: '   ', positionMs: 10 })), null);
  assert.equal(parseResume(JSON.stringify({ trackId: 'track-1', positionMs: -1 })), null);
  assert.equal(parseResume(JSON.stringify({ trackId: 'track-1', positionMs: '10' })), null);
  assert.equal(parseResume(JSON.stringify({ trackId: 'track-1', positionMs: Infinity })), null);
  assert.equal(parseResume(JSON.stringify({ trackId: 7, positionMs: 10 })), null);
});

test('isResumeState guards the serialized shape', () => {
  assert.equal(isResumeState({ trackId: 'a', positionMs: 0 }), true);
  assert.equal(isResumeState({ trackId: 'a', positionMs: 1.5 }), true);
  assert.equal(isResumeState({ trackId: '', positionMs: 0 }), false);
  assert.equal(isResumeState({ trackId: 'a', positionMs: Number.NaN }), false);
  assert.equal(isResumeState(null), false);
  assert.equal(isResumeState('resume'), false);
});

test('serializeResume rejects invalid state instead of writing a bad resume point', () => {
  assert.throws(() => serializeResume({ trackId: '', positionMs: 10 }));
  assert.throws(() => serializeResume({ trackId: 'track-1', positionMs: -5 }));
});

test('scan preference parses only explicit booleans', () => {
  assert.equal(parseScanPref('true'), true);
  assert.equal(parseScanPref('false'), false);
  assert.equal(parseScanPref(null), false);
  assert.equal(parseScanPref(undefined), false);
  assert.equal(parseScanPref(''), false);
  assert.equal(parseScanPref('1'), false);
  assert.equal(parseScanPref('yes'), false);
  assert.equal(serializeScanPref(true), 'true');
  assert.equal(serializeScanPref(false), 'false');
});

test('scan preference defaults to off when the key is absent', async () => {
  const storage = memoryStorage();
  assert.equal(await loadScanPref(storage), false);
});

test('scan preference round-trips through the fixed key', async () => {
  const storage = memoryStorage();
  await saveScanPref(true, storage);
  assert.equal(storage.data.get(SCAN_PREF_KEY), 'true');
  assert.equal(await loadScanPref(storage), true);

  await saveScanPref(false, storage);
  assert.equal(storage.data.get(SCAN_PREF_KEY), 'false');
  assert.equal(await loadScanPref(storage), false);
});

test('scan preference survives storage read failures as off', async () => {
  const failing = {
    async getItem(): Promise<string | null> {
      throw new Error('storage unavailable');
    },
    async setItem(): Promise<void> {},
  };
  assert.equal(await loadScanPref(failing), false);
});
