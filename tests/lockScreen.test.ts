import assert from 'node:assert/strict';
import test from 'node:test';
import { needsLockScreenReassert } from '../src/lib/lockScreen.ts';

const base = {
  isActive: true,
  isLoaded: true,
  durationMs: 210_000,
  trackId: 't1',
  reassertedTrackId: null,
};

test('reasserts once per track when duration is known', () => {
  assert.equal(needsLockScreenReassert(base), true);
  assert.equal(needsLockScreenReassert({ ...base, reassertedTrackId: 't1' }), false);
  assert.equal(
    needsLockScreenReassert({ ...base, trackId: 't2', reassertedTrackId: 't1' }),
    true,
  );
});

test('does not reassert before load, without duration, or when inactive', () => {
  assert.equal(needsLockScreenReassert({ ...base, isLoaded: false }), false);
  assert.equal(needsLockScreenReassert({ ...base, durationMs: 0 }), false);
  assert.equal(needsLockScreenReassert({ ...base, isActive: false }), false);
});
