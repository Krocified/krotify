import assert from 'node:assert/strict';
import test from 'node:test';
import { importLyricsText } from '../src/library/lyricsImport.ts';

test('stores synced lyrics and reports the line count', async () => {
  const writes: { trackId: string; kind: string; text?: string }[] = [];
  const text = '[00:01.00]one\n[00:02.00]two\n';
  const result = await importLyricsText('t1', text, async (trackId, lyrics) => {
    writes.push({ trackId, ...lyrics });
  });
  assert.deepEqual(result, { kind: 'synced', lineCount: 2 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.kind, 'synced');
  assert.equal(writes[0]?.text, text);
});

test('stores untimed text as plain', async () => {
  let kind: string | undefined;
  const result = await importLyricsText('t1', 'just words\nmore words\n', async (_trackId, lyrics) => {
    kind = lyrics.kind;
  });
  assert.deepEqual(result, { kind: 'plain', lineCount: 0 });
  assert.equal(kind, 'plain');
});

test('rejects an empty file without writing', async () => {
  let wrote = false;
  await assert.rejects(
    importLyricsText('t1', '   \n\n', async () => {
      wrote = true;
    }),
  );
  assert.equal(wrote, false);
});

test('rejects a metadata-only file without writing', async () => {
  let wrote = false;
  await assert.rejects(
    importLyricsText('t1', '[ar:Someone]\n[ti:A song]\n[offset:+10]\n', async () => {
      wrote = true;
    }),
  );
  assert.equal(wrote, false);
});
