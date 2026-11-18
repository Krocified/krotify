import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinePath, mirroredPath } from '../src/lib/waveGeometry.ts';

const base = { width: 800, height: 64, periods: 3, amplitude: 10, phase: 0 };

test('paths start with M and use finite numbers', () => {
  for (const d of [sinePath(base), mirroredPath(base)]) {
    assert.ok(d.startsWith('M'));
    assert.ok(!d.includes('NaN'));
    assert.ok(!d.includes('Infinity'));
  }
});

test('paths scale with amplitude and periods', () => {
  assert.notEqual(sinePath(base), sinePath({ ...base, periods: 5 }));
  assert.notEqual(sinePath(base), sinePath({ ...base, amplitude: 20 }));
  assert.notEqual(mirroredPath(base), mirroredPath({ ...base, amplitude: 20 }));
});

test('paths shift with phase', () => {
  assert.notEqual(sinePath(base), sinePath({ ...base, phase: Math.PI / 2 }));
});
