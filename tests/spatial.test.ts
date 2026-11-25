import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPATIAL_KEY,
  SPATIAL_MODES,
  loadSpatialMode,
  parseSpatialMode,
  resolveSpatialMode,
  saveSpatialMode,
  serializeSpatialMode,
  shouldFallbackSpatial,
  spatialModeLabel,
  spatialNote,
  spatialRequest,
  spatialStrength,
} from '../src/lib/spatial.ts';

test('parseSpatialMode defaults to off for unknown input', () => {
  assert.equal(parseSpatialMode(null), 'off');
  assert.equal(parseSpatialMode(undefined), 'off');
  assert.equal(parseSpatialMode(''), 'off');
  assert.equal(parseSpatialMode('surround'), 'off');
});

test('parseSpatialMode accepts every mode', () => {
  for (const mode of SPATIAL_MODES) assert.equal(parseSpatialMode(mode), mode);
});

test('serializeSpatialMode round-trips', () => {
  for (const mode of SPATIAL_MODES) {
    assert.equal(parseSpatialMode(serializeSpatialMode(mode)), mode);
  }
});

test('spatialStrength pins preset values', () => {
  assert.equal(spatialStrength('off'), 0);
  assert.equal(spatialStrength('low'), 400);
  assert.equal(spatialStrength('medium'), 700);
  assert.equal(spatialStrength('high'), 1000);
});

test('spatialRequest disables off and enables the rest', () => {
  assert.deepEqual(spatialRequest('off'), { enabled: false, strength: 0 });
  assert.deepEqual(spatialRequest('high'), { enabled: true, strength: 1000 });
});

test('spatialModeLabel is user-facing', () => {
  assert.deepEqual(SPATIAL_MODES.map(spatialModeLabel), ['Off', 'Low', 'Medium', 'High']);
});

test('spatialNote only warns on definitive unsupported', () => {
  assert.equal(spatialNote(null), null);
  assert.equal(spatialNote(true), null);
  assert.equal(spatialNote(false), 'Not supported on this device');
});

test('shouldFallbackSpatial only forces off when unsupported', () => {
  assert.equal(shouldFallbackSpatial('high', false), true);
  assert.equal(shouldFallbackSpatial('off', false), false);
  assert.equal(shouldFallbackSpatial('high', null), false);
  assert.equal(shouldFallbackSpatial('high', true), false);
});

test('resolveSpatialMode forces off when the feature flag is off', () => {
  for (const mode of SPATIAL_MODES) {
    assert.equal(resolveSpatialMode(false, mode), 'off');
    assert.equal(resolveSpatialMode(true, mode), mode);
  }
});

test('loadSpatialMode reads and defaults', async () => {
  const store = {
    value: null as string | null,
    getItem: async () => store.value,
    setItem: async (_key: string, value: string) => {
      store.value = value;
    },
  };
  assert.equal(await loadSpatialMode(store), 'off');
  store.value = 'medium';
  assert.equal(await loadSpatialMode(store), 'medium');
});

test('saveSpatialMode writes the mode under the key', async () => {
  const calls: [string, string][] = [];
  const store = {
    getItem: async () => null,
    setItem: async (key: string, value: string) => {
      calls.push([key, value]);
    },
  };
  await saveSpatialMode('low', store);
  assert.deepEqual(calls, [[SPATIAL_KEY, 'low']]);
});
