import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBIENT_BLOBS, BLOB_LOOP_MS } from '../src/lib/ambientBlobs.ts';

test('ambient loop runs for at least one hour', () => {
  assert.ok(BLOB_LOOP_MS >= 60 * 60 * 1000);
});

test('ambient blobs are circles with whole-number frequencies', () => {
  assert.ok(AMBIENT_BLOBS.length >= 8);
  for (const blob of AMBIENT_BLOBS) {
    for (const value of [blob.fx, blob.fy, blob.fs, blob.fo]) {
      assert.ok(Number.isInteger(value) && value > 0);
    }
    assert.ok(blob.size > 0 && blob.size <= 1.2);
    assert.ok(blob.opacity > 0 && blob.opacity <= 1);
    assert.ok(blob.scaleAmp >= 0 && blob.scaleAmp < 0.5);
    assert.ok(blob.phase >= 0 && blob.phase < Math.PI * 2);
  }
});

test('ambient blobs use both cover colors', () => {
  const used = new Set(AMBIENT_BLOBS.map((blob) => blob.colorIndex));
  assert.deepEqual([...used].sort(), [0, 1]);
});
