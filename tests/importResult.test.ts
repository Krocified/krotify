import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importResultMessage } from '../src/lib/importResult.ts';

test('reports a single imported file', () => {
  assert.equal(importResultMessage(1, 0), '1 file imported');
});

test('reports several imported files', () => {
  assert.equal(importResultMessage(3, 0), '3 files imported');
});

test('reports imported and failed counts together', () => {
  assert.equal(importResultMessage(2, 1), '2 files imported, 1 failed');
});

test('does not claim success when nothing was added', () => {
  assert.equal(importResultMessage(0, 2), 'No files were imported');
  assert.equal(importResultMessage(0, 0), '');
});
