import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverColors, coverInitial } from '../src/lib/cover.ts';

test('coverColors returns two stable hex colors', () => {
  const colors = coverColors(210);
  assert.equal(colors.length, 2);
  for (const color of colors) assert.match(color, /^#[0-9a-f]{6}$/);
  assert.deepEqual(coverColors(210), colors);
  assert.deepEqual(coverColors(570), coverColors(210));
});

test('coverInitial picks the first alphanumeric', () => {
  assert.equal(coverInitial('alpha'), 'A');
  assert.equal(coverInitial('  99 balloons'), '9');
  assert.equal(coverInitial('!!!'), '?');
  assert.equal(coverInitial(''), '?');
});
