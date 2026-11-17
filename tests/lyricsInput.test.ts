import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLyricsInput, parseTimestamp } from '../src/lib/lyricsInput.ts';

test('detects LRC and keeps lines', () => {
  const result = parseLyricsInput('[00:01.00]one\n[00:02.50]two\n');
  assert.equal(result.format, 'lrc');
  assert.equal(result.kind, 'synced');
  assert.equal(result.lineCount, 2);
});

test('normalizes YAML lines to LRC', () => {
  const result = parseLyricsInput('lines:\n  - time: 0:12.50\n    text: Hello\n  - at: 15\n    text: World\n');
  assert.equal(result.format, 'yaml');
  assert.equal(result.kind, 'synced');
  assert.equal(result.text, '[00:12.50]Hello\n[00:15.00]World');
  assert.deepEqual(result.lines, [
    { atMs: 12500, text: 'Hello' },
    { atMs: 15000, text: 'World' },
  ]);
});

test('accepts a root YAML list and quoted values', () => {
  const result = parseLyricsInput('- time: "00:05.25"\n  text: "First"\n');
  assert.equal(result.format, 'yaml');
  assert.equal(result.lineCount, 1);
});

test('falls back to plain text', () => {
  const result = parseLyricsInput('line one\nline two\n');
  assert.equal(result.format, 'plain');
  assert.equal(result.kind, 'plain');
  assert.equal(result.lineCount, 0);
});

test('rejects empty and metadata-only input', () => {
  assert.throws(() => parseLyricsInput('   \n'));
  assert.throws(() => parseLyricsInput('[ar:Someone]\n[ti:Song]\n'));
});

test('parses timestamps', () => {
  assert.equal(parseTimestamp('00:12.50'), 12500);
  assert.equal(parseTimestamp('1:02:03.5'), 3723500);
  assert.equal(parseTimestamp(12.5), 12500);
  assert.equal(parseTimestamp('bad'), null);
});
