import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVisualizerStyle, VISUALIZER_STYLES } from '../src/lib/visualizerStyle.ts';

test('pick is deterministic per seed', () => {
  for (const seed of ['track-1', 'track-2', 'Some Song (Remastered).mp3', '']) {
    assert.equal(pickVisualizerStyle(seed), pickVisualizerStyle(seed));
  }
});

test('pick always returns a known style', () => {
  for (let i = 0; i < 200; i += 1) {
    const pick = pickVisualizerStyle(`seed-${i}`);
    assert.ok((VISUALIZER_STYLES as readonly string[]).includes(pick));
  }
});

test('different seeds can pick different styles', () => {
  const picks = new Set(
    Array.from({ length: 50 }, (_, i) => pickVisualizerStyle(`seed-${i}`)),
  );
  assert.ok(picks.size > 1);
});
