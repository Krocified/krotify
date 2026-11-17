import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_IMPORT_ENABLED, LYRICS_ENABLED } from '../src/lib/features.ts';

test('lyrics UI is enabled in v7', () => {
  assert.equal(LYRICS_ENABLED, true);
});

test('link import stays hidden in v7', () => {
  assert.equal(LINK_IMPORT_ENABLED, false);
});
