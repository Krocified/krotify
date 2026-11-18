import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOB_COPIES,
  CURVE_LAYERS,
  wavePeriods,
} from '../src/lib/visualizerArt.ts';

const WIDTH = 320;
const HEIGHT = 64;
const periodWidth = WIDTH / 2;
const artWidth = WIDTH + periodWidth * 2;

test('every wave layer wraps the art in a whole number of drift periods', () => {
  const allPeriods = [
    ...wavePeriods('curves'),
    ...wavePeriods('soundwave'),
  ];
  assert.ok(allPeriods.length > 0);
  for (const periods of allPeriods) {
    const ratio = (periods * 2) * periodWidth / artWidth;
    assert.ok(
      Number.isInteger(ratio),
      `periods ${periods}: (${periods} × 2) × ${periodWidth} / ${artWidth} = ${ratio}`,
    );
  }
});

test('curve layer period configs are even so their doubled wave periods stay aligned', () => {
  for (const layer of CURVE_LAYERS) {
    assert.equal(layer.periods % 2, 0, `curve layer periods ${layer.periods} is odd`);
  }
});

test('blob copies tile past the art width so the blob seam is periodic', () => {
  assert.ok(
    BLOB_COPIES * WIDTH >= artWidth,
    `${BLOB_COPIES} copies × ${WIDTH} do not cover art width ${artWidth}`,
  );
});
