import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LYRICS_ENABLED } from '../src/lib/features.ts';

test('lyrics UI stays hidden for v5', () => {
  assert.equal(LYRICS_ENABLED, false);
});
