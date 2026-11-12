import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommits, detectBump, nextVersion } from '../scripts/next-version.mts';

test('feat is a minor bump', () => {
  assert.equal(classifyCommits(['feat(ui): add albums tab']), 'minor');
});

test('fix and chore are patch bumps', () => {
  assert.equal(classifyCommits(['fix: player crash']), 'patch');
  assert.equal(classifyCommits(['chore: bump deps', 'docs: readme']), 'patch');
});

test('breaking subjects and footers are major', () => {
  assert.equal(classifyCommits(['feat!: drop legacy queue']), 'major');
  assert.equal(classifyCommits(['fix: thing\n\nBREAKING CHANGE: new api']), 'major');
});

test('mixed commits take the highest bump', () => {
  assert.equal(classifyCommits(['fix: a', 'feat: b', 'chore: c']), 'minor');
  assert.equal(classifyCommits(['feat: a', 'fix!: b']), 'major');
});

test('merge commits are ignored; empty ranges are patch', () => {
  assert.equal(classifyCommits(['Merge branch main', 'fix: a']), 'patch');
  assert.equal(classifyCommits([]), 'patch');
});

test('manual override beats detection', () => {
  assert.equal(detectBump('v1.2.3', ['fix: a'], 'major'), 'major');
  assert.equal(detectBump('v1.2.3', ['feat: a'], 'auto'), 'minor');
});

test('nextVersion applies bumps and computes versionCode', () => {
  assert.deepEqual(nextVersion('v1.2.3', 'major'), { version: '2.0.0', versionCode: 20000, tag: 'v2.0.0' });
  assert.deepEqual(nextVersion('v1.2.3', 'minor'), { version: '1.3.0', versionCode: 10300, tag: 'v1.3.0' });
  assert.deepEqual(nextVersion('v1.2.3', 'patch'), { version: '1.2.4', versionCode: 10204, tag: 'v1.2.4' });
});

test('first release starts at 0.1.0', () => {
  assert.deepEqual(nextVersion(null, 'patch'), { version: '0.1.0', versionCode: 100, tag: 'v0.1.0' });
});
