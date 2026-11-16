import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripCollisionSuffix,
  uniqueFileName,
  withCollisionSuffix,
} from '../src/storage/names.ts';

test('a free name is unchanged', () => {
  assert.equal(uniqueFileName('Song.mp3', new Set()), 'Song.mp3');
});

test('a collision adds a space and a number before the extension', () => {
  assert.equal(withCollisionSuffix('Song.mp3', 2), 'Song (2).mp3');
});

test('repeated collisions keep increasing', () => {
  assert.equal(
    uniqueFileName('Song.mp3', new Set(['Song.mp3', 'Song (2).mp3'])),
    'Song (3).mp3',
  );
});

test('an existing suffix does not confuse the next free name', () => {
  assert.equal(uniqueFileName('Song (2).mp3', new Set(['Song.mp3'])), 'Song (2).mp3');
});

test('a name without an extension still gets a suffix', () => {
  assert.equal(withCollisionSuffix('track', 3), 'track (3)');
});

test('a hidden extension is preserved', () => {
  assert.equal(withCollisionSuffix('.nomedia', 2), '.nomedia (2)');
});

test('stripCollisionSuffix removes only a numeric collision suffix', () => {
  assert.equal(stripCollisionSuffix('Song.mp3'), 'Song.mp3');
  assert.equal(stripCollisionSuffix('Song (2).mp3'), 'Song.mp3');
  assert.equal(stripCollisionSuffix('Song (12).mp3'), 'Song.mp3');
  assert.equal(stripCollisionSuffix('Song (Live).mp3'), 'Song (Live).mp3');
  assert.equal(stripCollisionSuffix('Song (2)'), 'Song');
});
