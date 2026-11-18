import assert from 'node:assert/strict';
import test from 'node:test';
import { sheetKeyboardMetrics } from '../src/lib/sheetKeyboard.ts';

test('no keyboard means no lift and the 88% cap', () => {
  const metrics = sheetKeyboardMetrics({
    keyboardHeight: 0,
    bottomInset: 24,
    viewportHeight: 1000,
  });
  assert.equal(metrics.lift, 0);
  assert.equal(metrics.maxHeight, 880);
});

test('lift subtracts the bottom inset the panel already pads', () => {
  const metrics = sheetKeyboardMetrics({
    keyboardHeight: 320,
    bottomInset: 24,
    viewportHeight: 1000,
  });
  assert.equal(metrics.lift, 296);
  assert.equal(metrics.maxHeight, 608);
});

test('maxHeight has a floor and never exceeds the viewport', () => {
  assert.equal(
    sheetKeyboardMetrics({ keyboardHeight: 500, bottomInset: 0, viewportHeight: 400 }).maxHeight,
    240,
  );
  assert.equal(
    sheetKeyboardMetrics({ keyboardHeight: 0, bottomInset: 0, viewportHeight: 0 }).maxHeight,
    240,
  );
});
