import assert from 'node:assert/strict';
import test from 'node:test';
import { isHexColor, readCoverColor } from '../src/library/palette.ts';

test('accepts six-digit hex colors', () => {
  assert.equal(isHexColor('#1a2B3c'), true);
  assert.equal(isHexColor('1a2b3c'), false);
  assert.equal(isHexColor('#12345'), false);
});

test('returns the reader color when valid', async () => {
  const color = await readCoverColor('file:///a.jpg', {
    dominantColor: async () => '#AA00FF',
  });
  assert.equal(color, '#AA00FF');
});

test('drops an invalid reader result', async () => {
  const color = await readCoverColor('file:///a.jpg', {
    dominantColor: async () => 'nope',
  });
  assert.equal(color, null);
});

test('swallows a reader failure', async () => {
  const color = await readCoverColor('file:///a.jpg', {
    dominantColor: async () => {
      throw new Error('decode failed');
    },
  });
  assert.equal(color, null);
});
