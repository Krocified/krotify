import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearSelection,
  selectVisible,
  selectionBackHandler,
  selectionState,
  toggleAllVisible,
  toggleId,
} from '../src/lib/selection.ts';

test('toggleId adds then removes an id and never mutates the input', () => {
  const start = new Set(['a']);
  const added = toggleId(start, 'b');
  assert.deepEqual([...added].sort(), ['a', 'b']);
  assert.deepEqual([...start], ['a']);
  assert.deepEqual([...toggleId(added, 'b')], ['a']);
});

test('selectionState reports none, partial and all over visible ids', () => {
  assert.equal(selectionState(new Set(), ['a', 'b']), 'none');
  assert.equal(selectionState(new Set(['a']), ['a', 'b']), 'partial');
  assert.equal(selectionState(new Set(['a', 'b', 'c']), ['a', 'b']), 'all');
  assert.equal(selectionState(new Set(['z']), ['a', 'b']), 'none');
  assert.equal(selectionState(new Set(['z']), []), 'none');
});

test('selectVisible unions only visible ids', () => {
  const next = selectVisible(new Set(['z']), ['a', 'b']);
  assert.deepEqual([...next].sort(), ['a', 'b', 'z']);
});

test('toggleAllVisible selects every visible id from partial', () => {
  const next = toggleAllVisible(new Set(['a', 'z']), ['a', 'b']);
  assert.deepEqual([...next].sort(), ['a', 'b', 'z']);
});

test('toggleAllVisible clears only visible ids from all', () => {
  const next = toggleAllVisible(new Set(['a', 'b', 'z']), ['a', 'b']);
  assert.deepEqual([...next], ['z']);
});

test('clearSelection returns an empty set', () => {
  assert.equal(clearSelection().size, 0);
});

test('selectionBackHandler is null when inactive and exits when active', () => {
  let exited = 0;
  assert.equal(selectionBackHandler(false, () => { exited += 1; }), null);
  const handler = selectionBackHandler(true, () => { exited += 1; });
  assert.ok(handler);
  assert.equal(handler(), true);
  assert.equal(exited, 1);
});
