import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { tagCoverage } from '../src/tags/filter.ts';

test('tagCoverage is none, partial and all over the selected tracks', () => {
  const assignments = new Map([
    ['a', ['x']],
    ['b', ['x', 'y']],
  ]);
  assert.equal(tagCoverage(assignments, ['a', 'b'], 'x'), 'all');
  assert.equal(tagCoverage(assignments, ['a', 'b'], 'y'), 'partial');
  assert.equal(tagCoverage(assignments, ['a', 'b'], 'z'), 'none');
  assert.equal(tagCoverage(assignments, [], 'x'), 'none');
});

test('queries export a bulk assign statement', () => {
  const source = readFileSync(new URL('../src/tags/queries.ts', import.meta.url), 'utf8');
  assert.match(source, /INSERT OR IGNORE INTO track_tags/);
});
