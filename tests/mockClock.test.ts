import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockTick } from '../src/lib/mockClock.ts';

test('mockTick advances and reports finish', () => {
  assert.deepEqual(mockTick(0, 500, 1_000), { positionMs: 500, finished: false });
  assert.deepEqual(mockTick(700, 500, 1_000), { positionMs: 1_000, finished: true });
  assert.deepEqual(mockTick(1_000, 500, 1_000), { positionMs: 1_000, finished: true });
});
