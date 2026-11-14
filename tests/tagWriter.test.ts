import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTagWriter,
  TagWriteError,
  type TagEditDeps,
} from '../src/library/tagWriter.ts';
import type { CachedMetadata } from '../src/db/repo.ts';
import type { Track } from '../src/types.ts';

const track: Track = {
  id: 'track-1',
  uri: 'file:///music/song.mp3',
  source: 'scan',
  title: 'Old Title',
  artist: 'Artist',
  album: 'Album',
  durationMs: 1_000,
  artworkHue: 0,
};

type Calls = {
  snapshot: string[];
  write: { uri: string; fields: unknown }[];
  restore: { uri: string; snapshotPath: string }[];
  discard: string[];
  put: { id: string; meta: CachedMetadata }[];
};

function makeDeps(overrides: Partial<TagEditDeps> = {}) {
  const calls: Calls = { snapshot: [], write: [], restore: [], discard: [], put: [] };
  const deps: TagEditDeps = {
    async snapshotFile(uri) {
      calls.snapshot.push(uri);
      return '/cache/snapshot.mp3';
    },
    async writeTags(uri, fields) {
      calls.write.push({ uri, fields });
      return fields;
    },
    async restoreFile(uri, snapshotPath) {
      calls.restore.push({ uri, snapshotPath });
    },
    async discardSnapshot(snapshotPath) {
      calls.discard.push(snapshotPath);
    },
    async getCachedMetadata() {
      return null;
    },
    async putCachedMetadata(id, meta) {
      calls.put.push({ id, meta });
    },
    ...overrides,
  };
  return { deps, calls };
}

function nativeError(code: string | undefined, message: string): Error {
  const error = new Error(message) as Error & { code?: string };
  if (code) error.code = code;
  return error;
}

function isTagWriteError(code: string) {
  return (error: unknown): boolean =>
    error instanceof TagWriteError && error.code === code;
}

test('applyTagEdit writes, updates the cache and returns the refreshed track', async () => {
  const { deps, calls } = makeDeps();
  const applyTagEdit = createTagWriter(deps);

  const result = await applyTagEdit(track, { title: '  New Title  ', album: 'New Album' });

  assert.equal(result.title, 'New Title');
  assert.equal(result.album, 'New Album');
  assert.deepEqual(calls.snapshot, [track.uri]);
  assert.deepEqual(calls.write, [
    { uri: track.uri, fields: { title: 'New Title', album: 'New Album' } },
  ]);
  assert.deepEqual(calls.put, [
    { id: track.id, meta: { title: 'New Title', album: 'New Album' } },
  ]);
  assert.deepEqual(calls.discard, ['/cache/snapshot.mp3']);
  assert.deepEqual(calls.restore, []);
});

test('an invalid patch is rejected before any file or cache work', async () => {
  const { deps, calls } = makeDeps();
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(applyTagEdit(track, {}), isTagWriteError('INVALID_PATCH'));
  assert.deepEqual(calls.snapshot, []);
  assert.deepEqual(calls.write, []);
  assert.deepEqual(calls.put, []);
});

test('a track without a URI is rejected before any file or cache work', async () => {
  const { deps, calls } = makeDeps();
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(
    applyTagEdit({ ...track, uri: '' }, { title: 'New' }),
    isTagWriteError('UNAVAILABLE'),
  );
  assert.deepEqual(calls.snapshot, []);
});

test('a native write failure leaves the cache unchanged and discards the snapshot', async () => {
  const { deps, calls } = makeDeps({
    async writeTags() {
      throw nativeError('UNSUPPORTED_FORMAT', 'Unsupported audio format');
    },
  });
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(
    applyTagEdit(track, { title: 'New' }),
    isTagWriteError('UNSUPPORTED_FORMAT'),
  );
  assert.deepEqual(calls.put, []);
  assert.deepEqual(calls.restore, []);
  assert.deepEqual(calls.discard, ['/cache/snapshot.mp3']);
});

test('an unknown native error maps to WRITE_FAILED', async () => {
  const { deps } = makeDeps({
    async writeTags() {
      throw nativeError(undefined, 'native exploded');
    },
  });
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(applyTagEdit(track, { title: 'New' }), (error) => {
    assert.equal(error instanceof TagWriteError, true);
    if (!(error instanceof TagWriteError)) return false;
    assert.equal(error.code, 'WRITE_FAILED');
    assert.match(error.message, /native exploded/);
    return true;
  });
});

test('native error codes such as NO_WRITE_ACCESS are preserved', async () => {
  const { deps } = makeDeps({
    async snapshotFile() {
      throw nativeError('NO_WRITE_ACCESS', 'content URIs are not writable');
    },
  });
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(applyTagEdit(track, { title: 'New' }), (error) => {
    assert.equal(error instanceof TagWriteError, true);
    if (!(error instanceof TagWriteError)) return false;
    assert.equal(error.code, 'NO_WRITE_ACCESS');
    return true;
  });
});

test('a cache failure restores the original bytes and reports CACHE_FAILED', async () => {
  const { deps, calls } = makeDeps({
    async getCachedMetadata() {
      return { title: 'Old Title' };
    },
    async putCachedMetadata() {
      throw new Error('sqlite unavailable');
    },
  });
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(applyTagEdit(track, { album: 'New Album' }), (error) => {
    assert.equal(error instanceof TagWriteError, true);
    if (!(error instanceof TagWriteError)) return false;
    assert.equal(error.code, 'CACHE_FAILED');
    assert.match(error.message, /restored the original file/);
    return true;
  });
  assert.deepEqual(calls.write, [{ uri: track.uri, fields: { album: 'New Album' } }]);
  assert.deepEqual(calls.restore, [{ uri: track.uri, snapshotPath: '/cache/snapshot.mp3' }]);
  assert.deepEqual(calls.discard, []);
});

test('a failed rollback is surfaced, not swallowed, and keeps the snapshot', async () => {
  const { deps, calls } = makeDeps({
    async putCachedMetadata() {
      throw new Error('sqlite unavailable');
    },
    async restoreFile(uri, snapshotPath) {
      calls.restore.push({ uri, snapshotPath });
      throw nativeError('WRITE_FAILED', 'atomic move failed');
    },
  });
  const applyTagEdit = createTagWriter(deps);

  await assert.rejects(applyTagEdit(track, { title: 'New' }), (error) => {
    assert.equal(error instanceof TagWriteError, true);
    if (!(error instanceof TagWriteError)) return false;
    assert.equal(error.code, 'CACHE_FAILED');
    assert.match(error.message, /could not restore the original file/i);
    assert.match(error.message, /atomic move failed/i);
    assert.match(error.message, /\/cache\/snapshot\.mp3/);
    assert.equal((error.cause as Error).message, 'atomic move failed');
    return true;
  });
  assert.deepEqual(calls.restore, [{ uri: track.uri, snapshotPath: '/cache/snapshot.mp3' }]);
  assert.deepEqual(calls.discard, []);
});
