import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustColor, ambientTheme } from '../src/lib/ambient.ts';
import { isHexColor } from '../src/library/palette.ts';

test('adjustColor lightens and darkens and clamps', () => {
  assert.equal(adjustColor('#000000', 1), '#ffffff');
  assert.equal(adjustColor('#ffffff', -1), '#000000');
  assert.equal(adjustColor('#808080', 0), '#808080');
  assert.equal(adjustColor('#zzzzzz', 0.2), '#000000');
});

test('ambientTheme is deterministic for a seed', () => {
  const input = { seed: 'track:1', coverColor: '#3366AA', hue: 42 };
  assert.deepEqual(ambientTheme(input), ambientTheme(input));
  assert.notDeepEqual(
    ambientTheme(input).pools.map((p) => p.x),
    ambientTheme({ ...input, seed: 'track:2' }).pools.map((p) => p.x),
  );
});

test('ambientTheme stays in range with and without a cover color', () => {
  for (const coverColor of ['#3366AA', null]) {
    const theme = ambientTheme({ seed: 'track:1', coverColor, hue: 42 });
    assert.ok(isHexColor(theme.base));
    assert.ok(isHexColor(theme.top));
    assert.ok(isHexColor(theme.bottom));
    assert.equal(theme.pools.length, 3);
    for (const pool of theme.pools) {
      assert.ok(isHexColor(pool.color));
      assert.ok(pool.size >= 0.9 && pool.size <= 1.6);
      assert.ok(pool.driftX >= -0.25 && pool.driftX <= 0.25);
      assert.ok(pool.durationMs >= 60000 && pool.durationMs <= 120000);
    }
  }
});
