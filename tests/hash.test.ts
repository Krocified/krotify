import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashString, hueFromSeed } from '../src/lib/hash.ts';

test('hashString is deterministic', () => {
  assert.equal(hashString('krotify'), hashString('krotify'));
  assert.notEqual(hashString('krotify'), hashString('krotifz'));
});

test('hueFromSeed is always a hue', () => {
  for (const seed of ['', 'a', 'Album Name', 'Song (Remastered).mp3']) {
    const hue = hueFromSeed(seed);
    assert.ok(Number.isInteger(hue));
    assert.ok(hue >= 0 && hue <= 359, `hue ${hue} out of range for ${seed}`);
  }
});
