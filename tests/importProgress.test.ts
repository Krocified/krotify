import assert from 'node:assert/strict';
import test from 'node:test';
import {
  importProgressFraction,
  importProgressLabel,
} from '../src/lib/importProgress.ts';

test('labels the current file and position', () => {
  assert.equal(
    importProgressLabel({ index: 3, total: 12, name: 'Song.mp3' }),
    'Importing 3 of 12 — Song.mp3',
  );
});

test('fraction is index over total clamped to 0..1', () => {
  assert.equal(importProgressFraction({ index: 1, total: 4, name: 'a' }), 0.25);
  assert.equal(importProgressFraction({ index: 9, total: 4, name: 'a' }), 1);
  assert.equal(importProgressFraction({ index: 0, total: 0, name: 'a' }), 0);
});
