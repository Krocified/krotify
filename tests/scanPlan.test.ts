import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterScanCandidates, ownedKey } from '../src/tracks/scanPlan.ts';
import type { ScanTrackInput } from '../src/tracks/types.ts';

function candidate(overrides: Partial<ScanTrackInput> = {}): ScanTrackInput {
  return {
    id: 'asset-1',
    location: 'file:///storage/emulated/0/Music/Other/song.mp3',
    fileName: 'song.mp3',
    sizeBytes: 4_096,
    durationMs: 180_000,
    ...overrides,
  };
}

test('an asset under the app owned root is skipped by path prefix', () => {
  const result = filterScanCandidates(
    [candidate({ location: 'file:///storage/emulated/0/Music/Krotify/song.mp3' })],
    {
      rootUri: 'file:///storage/emulated/0/Music/Krotify',
      ownedKeys: new Set(),
    },
  );

  assert.deepEqual(result.accepted, []);
  assert.equal(result.skippedOwned, 1);
});

test('a content uri root falls back to name and size', () => {
  const asset = candidate({
    location: 'content://media/external/audio/media/42',
    fileName: 'song.mp3',
    sizeBytes: 4_096,
  });
  const key = ownedKey('song.mp3', 4_096);
  assert.ok(key);

  const result = filterScanCandidates([asset], {
    rootUri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic%2FKrotify',
    ownedKeys: new Set([key]),
  });

  assert.deepEqual(result.accepted, []);
  assert.equal(result.skippedOwned, 1);
});

test('an owned name and size is skipped even without a prefix match', () => {
  const asset = candidate({
    location: 'file:///storage/emulated/0/Music/Other/song.mp3',
  });
  const key = ownedKey(asset.fileName, asset.sizeBytes);
  assert.ok(key);

  const result = filterScanCandidates([asset], {
    rootUri: 'file:///data/user/0/app/files/Krotify',
    ownedKeys: new Set([key]),
  });

  assert.deepEqual(result.accepted, []);
  assert.equal(result.skippedOwned, 1);
});

test('a scan asset outside the root is kept', () => {
  const asset = candidate();

  const result = filterScanCandidates([asset], {
    rootUri: 'file:///storage/emulated/0/Music/Krotify',
    ownedKeys: new Set([ownedKey('other.mp3', 4_096) ?? '']),
  });

  assert.deepEqual(result.accepted, [asset]);
  assert.equal(result.skippedOwned, 0);
});

test('an asset with no size cannot match the fallback and is kept', () => {
  const asset = candidate({ sizeBytes: undefined });

  const result = filterScanCandidates([asset], {
    rootUri: 'file:///storage/emulated/0/Music/Krotify',
    ownedKeys: new Set([ownedKey('song.mp3', 4_096) ?? '']),
  });

  assert.deepEqual(result.accepted, [asset]);
  assert.equal(result.skippedOwned, 0);
});
