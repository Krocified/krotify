import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  excludeAllMeta,
  formatBytes,
  hiddenTracksLabel,
  isMissingTrack,
  moveFilesLabel,
  permissionLabel,
  permissionStateFromResponse,
  reclaimableLabel,
  scanResultLabel,
} from '../src/lib/settingsView.ts';

test('permissionStateFromResponse maps granted undetermined and denied', () => {
  assert.equal(permissionStateFromResponse({ granted: true, status: 'granted' }), 'granted');
  assert.equal(permissionStateFromResponse({ granted: false, status: 'undetermined' }), 'not-asked');
  assert.equal(permissionStateFromResponse({ granted: false, status: 'denied' }), 'denied');
});

test('permissionLabel maps every permission state', () => {
  assert.equal(permissionLabel('granted'), 'Granted');
  assert.equal(permissionLabel('denied'), 'Not granted');
  assert.equal(permissionLabel('not-asked'), 'Not asked');
});

test('isMissingTrack accepts both flag shapes', () => {
  assert.equal(isMissingTrack({ missing: 1 }), true);
  assert.equal(isMissingTrack({ missing: true }), true);
  assert.equal(isMissingTrack({ missing: 0 }), false);
  assert.equal(isMissingTrack({}), false);
});

test('scanResultLabel reports found new and missing counts', () => {
  assert.equal(scanResultLabel(128, 3, 2), '128 tracks, 3 new, 2 missing');
});

test('excludeAllMeta gives a reason at zero', () => {
  assert.equal(excludeAllMeta(0), 'No scanned tracks to exclude');
  assert.equal(excludeAllMeta(4), '4 scanned tracks');
});

test('formatBytes uses readable binary units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('hiddenTracksLabel keeps the count beside the row title', () => {
  assert.equal(hiddenTracksLabel(0), 'Hidden tracks, 0');
  assert.equal(hiddenTracksLabel(3), 'Hidden tracks, 3');
});

test('moveFilesLabel and reclaimableLabel report files and space', () => {
  assert.equal(moveFilesLabel(2, 2048), 'Move 2 files (2.0 KB)');
  assert.equal(reclaimableLabel(2048), '2.0 KB reclaimable');
});
