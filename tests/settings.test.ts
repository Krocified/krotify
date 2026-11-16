import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScanSummary } from '../src/db/settings.ts';

test('scan summary is null before the first scan', () => {
  assert.equal(parseScanSummary({}), null);
  assert.equal(
    parseScanSummary({
      'scan.lastScanAt': null,
      'scan.found': null,
      'scan.new': null,
      'scan.missing': null,
    }),
    null,
  );
});

test('scan summary parses stored values', () => {
  assert.deepEqual(
    parseScanSummary({
      'scan.lastScanAt': '1730000000000',
      'scan.found': '42',
      'scan.new': '5',
      'scan.missing': '3',
    }),
    { lastScanAt: 1_730_000_000_000, found: 42, newTracks: 5, missing: 3 },
  );
});

test('scan summary rejects a partial row', () => {
  assert.equal(
    parseScanSummary({
      'scan.lastScanAt': '1730000000000',
      'scan.found': '42',
      'scan.new': '5',
    }),
    null,
  );
  assert.equal(
    parseScanSummary({
      'scan.lastScanAt': 'not a number',
      'scan.found': '42',
      'scan.new': '5',
      'scan.missing': '3',
    }),
    null,
  );
});
