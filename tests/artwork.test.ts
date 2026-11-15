import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCachedMetadata } from '../src/db/cachedMetadata.ts';
import type { CachedMetadata } from '../src/db/repo.ts';

test('keeps cached artwork when the patch omits artworkUri', () => {
  const existing: CachedMetadata = { title: 'Old', artworkUri: 'file:///art/cover.jpg' };
  const patch: CachedMetadata = { title: 'New' };
  assert.deepEqual(mergeCachedMetadata(existing, patch), {
    title: 'New',
    artworkUri: 'file:///art/cover.jpg',
  });
});

test('keeps cached artwork when the patch has an undefined artworkUri', () => {
  const existing: CachedMetadata = { artworkUri: 'file:///art/cover.jpg' };
  const patch: CachedMetadata = { artist: 'Artist', artworkUri: undefined };
  assert.deepEqual(mergeCachedMetadata(existing, patch), {
    artist: 'Artist',
    artworkUri: 'file:///art/cover.jpg',
  });
});

test('replaces cached artwork when the patch supplies one', () => {
  const existing: CachedMetadata = { artworkUri: 'file:///art/old.jpg' };
  const patch: CachedMetadata = { artworkUri: 'file:///art/new.jpg' };
  assert.deepEqual(mergeCachedMetadata(existing, patch), {
    artworkUri: 'file:///art/new.jpg',
  });
});

test('accepts a missing cache', () => {
  assert.deepEqual(mergeCachedMetadata(null, { title: 'New' }), { title: 'New' });
  assert.equal(mergeCachedMetadata(null, { artworkUri: undefined }).artworkUri, undefined);
});

test('still overwrites other keys, including with undefined', () => {
  const existing: CachedMetadata = {
    title: 'Old',
    artist: 'Old Artist',
    artworkUri: 'file:///art/cover.jpg',
  };
  const patch: CachedMetadata = { title: 'New', artist: undefined };
  assert.deepEqual(mergeCachedMetadata(existing, patch), {
    title: 'New',
    artist: undefined,
    artworkUri: 'file:///art/cover.jpg',
  });
});
