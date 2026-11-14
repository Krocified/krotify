import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLEEP_PRESETS, tickSleep } from '../src/lib/sleepTimer.ts';

test('SLEEP_PRESETS offers minute presets and end of track', () => {
  assert.deepEqual(SLEEP_PRESETS, [15, 30, 45, 60, 'end']);
});

test('tickSleep counts down by the elapsed time', () => {
  assert.deepEqual(tickSleep(60_000, 1_000), { remainingMs: 59_000, fadeFrom: null, done: false });
  assert.deepEqual(tickSleep(59_000, 250), { remainingMs: 58_750, fadeFrom: null, done: false });
});

test('tickSleep exposes a fade during the last ten seconds', () => {
  assert.deepEqual(tickSleep(10_000, 0), { remainingMs: 10_000, fadeFrom: 1, done: false });
  assert.deepEqual(tickSleep(9_000, 0), { remainingMs: 9_000, fadeFrom: 0.9, done: false });
  assert.deepEqual(tickSleep(5_000, 1_000), { remainingMs: 4_000, fadeFrom: 0.4, done: false });
  assert.deepEqual(tickSleep(1_000, 250), { remainingMs: 750, fadeFrom: 0.075, done: false });
});

test('tickSleep completes at zero and clamps overshoot', () => {
  assert.deepEqual(tickSleep(5_000, 5_000), { remainingMs: 0, fadeFrom: null, done: true });
  assert.deepEqual(tickSleep(5_000, 8_000), { remainingMs: 0, fadeFrom: null, done: true });
});

test('tickSleep treats an already-zero timer as done', () => {
  assert.deepEqual(tickSleep(0, 250), { remainingMs: 0, fadeFrom: null, done: true });
});

test('tickSleep ignores negative elapsed time', () => {
  assert.deepEqual(tickSleep(5_000, -1_000), { remainingMs: 5_000, fadeFrom: 0.5, done: false });
});
