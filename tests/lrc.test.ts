import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc } from '../src/lib/lrc.ts';

test('parses timestamps into milliseconds and sorts by time', () => {
  const parsed = parseLrc('[00:10.00]Second\n[00:02.50]First');
  assert.deepEqual(parsed.lines, [
    { atMs: 2_500, text: 'First' },
    { atMs: 10_000, text: 'Second' },
  ]);
  assert.equal(parsed.offsetMs, 0);
});

test('emits one line for every timestamp on a line', () => {
  const parsed = parseLrc('[00:05.00][00:45.25]Chorus');
  assert.deepEqual(parsed.lines, [
    { atMs: 5_000, text: 'Chorus' },
    { atMs: 45_250, text: 'Chorus' },
  ]);
});

test('normalizes one, two and three digit fractions', () => {
  const parsed = parseLrc('[00:01]A\n[00:01.5]B\n[00:01.05]C\n[00:01.005]D');
  assert.deepEqual(parsed.lines.map((line) => line.atMs), [1_000, 1_005, 1_050, 1_500]);
});

test('reads an offset tag and applies it to every line', () => {
  const parsed = parseLrc('[offset:+250]\n[00:01.00]Late\n[00:02.00]Later');
  assert.equal(parsed.offsetMs, 250);
  assert.deepEqual(parsed.lines, [
    { atMs: 1_250, text: 'Late' },
    { atMs: 2_250, text: 'Later' },
  ]);

  const negative = parseLrc('[00:03.00]Early\n[offset:-500]');
  assert.equal(negative.offsetMs, -500);
  assert.deepEqual(negative.lines, [{ atMs: 2_500, text: 'Early' }]);
});

test('handles CRLF and lone CR line endings', () => {
  const parsed = parseLrc('[00:01.00]One\r\n[00:02.00]Two\r[00:03.00]Three');
  assert.deepEqual(parsed.lines.map((line) => line.text), ['One', 'Two', 'Three']);
});

test('skips metadata, malformed lines and blank lyric text', () => {
  const parsed = parseLrc(
    [
      '[ti:Song]',
      '[ar:Artist]',
      '[al:Album]',
      'not a lyric line',
      '[0:99]bad seconds',
      '[00:01.00]',
      '[ 00:04.00 ]Spaced',
    ].join('\n'),
  );
  assert.deepEqual(parsed.lines, [{ atMs: 4_000, text: 'Spaced' }]);
});

test('returns no lines for empty input', () => {
  assert.deepEqual(parseLrc(''), { lines: [], offsetMs: 0 });
  assert.deepEqual(parseLrc('   \n\t\r\n'), { lines: [], offsetMs: 0 });
});
