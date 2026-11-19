import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitMarqueeText, MAX_MARQUEE_CHARS } from '../src/lib/marquee.ts';

test('marquee accepts text up to the limit unchanged', () => {
  const text = 'a'.repeat(MAX_MARQUEE_CHARS);
  assert.deepEqual(fitMarqueeText(text), { text, tooLong: false });
});

test('marquee flags text beyond the limit and keeps the first 250 characters', () => {
  const text = `${'a'.repeat(MAX_MARQUEE_CHARS)}b`;
  const result = fitMarqueeText(text);
  assert.equal(result.tooLong, true);
  assert.equal(result.text.length, MAX_MARQUEE_CHARS);
  assert.equal(result.text, 'a'.repeat(MAX_MARQUEE_CHARS));
});

test('marquee handles empty text', () => {
  assert.deepEqual(fitMarqueeText(''), { text: '', tooLong: false });
});
