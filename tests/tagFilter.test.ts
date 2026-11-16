import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentsFromRows,
  filterTracksByTag,
  reconcileTagFilter,
  setAssignment,
  tagBarVisible,
  visibleTags,
} from '../src/tags/filter.ts';

const tag = (id: string, name: string, count: number) => ({ id, name, count });
const tracks = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];

test('shows only tags with at least one active track', () => {
  assert.deepEqual(visibleTags([tag('a', 'Road', 2), tag('b', 'Live', 0)]), [tag('a', 'Road', 2)]);
});

test('orders tags by name case-insensitively', () => {
  assert.deepEqual(
    visibleTags([tag('a', 'road', 1), tag('b', 'Ambient', 1)]).map((item) => item.name),
    ['Ambient', 'road'],
  );
});

test('hides the tag bar when no tag has an active track', () => {
  assert.equal(tagBarVisible([]), false);
  assert.equal(tagBarVisible([tag('a', 'Road', 0)]), false);
});

test('keeps the bar visible when at least one tag has tracks', () => {
  assert.equal(tagBarVisible([tag('a', 'Road', 1)]), true);
});

test('keeps a selected tag that still has active tracks', () => {
  assert.equal(reconcileTagFilter('a', [tag('a', 'Road', 1)]), 'a');
});

test('clears a selected tag that no longer has active tracks', () => {
  assert.equal(reconcileTagFilter('a', [tag('a', 'Road', 0)]), null);
  assert.equal(reconcileTagFilter('missing', [tag('a', 'Road', 1)]), null);
});

test('returns all tracks when no tag is selected', () => {
  assert.deepEqual(filterTracksByTag(tracks, null, new Map()), tracks);
});

test('filters tracks by the selected tag', () => {
  const assignments = assignmentsFromRows([
    { trackId: 't1', tagId: 'a' },
    { trackId: 't3', tagId: 'a' },
  ]);
  assert.deepEqual(filterTracksByTag(tracks, 'a', assignments), [{ id: 't1' }, { id: 't3' }]);
});

test('does not mutate the track list', () => {
  const input = [...tracks];
  filterTracksByTag(input, 'a', assignmentsFromRows([{ trackId: 't1', tagId: 'a' }]));
  assert.deepEqual(input, tracks);
});

test('groups assignment rows by track id', () => {
  const map = assignmentsFromRows([
    { trackId: 't1', tagId: 'a' },
    { trackId: 't1', tagId: 'b' },
  ]);
  assert.deepEqual(map.get('t1'), ['a', 'b']);
});

test('adds an assignment without mutating the previous map', () => {
  const before = assignmentsFromRows([{ trackId: 't1', tagId: 'a' }]);
  const after = setAssignment(before, 't2', 'b', true);
  assert.equal(before.has('t2'), false);
  assert.deepEqual(after.get('t2'), ['b']);
});

test('removes only the selected assignment', () => {
  const before = assignmentsFromRows([
    { trackId: 't1', tagId: 'a' },
    { trackId: 't1', tagId: 'b' },
  ]);
  const after = setAssignment(before, 't1', 'a', false);
  assert.deepEqual(after.get('t1'), ['b']);
  assert.equal(setAssignment(after, 't1', 'b', false).has('t1'), false);
});
