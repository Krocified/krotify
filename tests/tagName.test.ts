import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTagName, TAG_NAME_MAX } from '../src/tags/name.ts';

test('trims and collapses whitespace in tag names', () => {
  assert.equal(normalizeTagName('  Road   Trip '), 'Road Trip');
});

test('rejects an empty tag name', () => {
  assert.equal(normalizeTagName('   '), null);
});

test('rejects a tag name longer than the limit', () => {
  assert.equal(normalizeTagName('a'.repeat(TAG_NAME_MAX + 1)), null);
});

test('keeps a name at the limit', () => {
  assert.equal(normalizeTagName('a'.repeat(TAG_NAME_MAX)), 'a'.repeat(TAG_NAME_MAX));
});
