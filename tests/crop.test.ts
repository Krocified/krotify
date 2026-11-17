import assert from 'node:assert/strict';
import test from 'node:test';
import { clampTransform, computeCropRect, type CropTransform } from '../src/lib/crop.ts';

function transform(scale = 1, translateX = 0, translateY = 0): CropTransform {
  return { scale, translateX, translateY };
}

test('square image keeps the full frame at scale 1', () => {
  const input = {
    imageWidth: 1000,
    imageHeight: 1000,
    viewport: 300,
    transform: transform(),
  };
  assert.deepEqual(clampTransform(input), transform());
  assert.deepEqual(computeCropRect(input), {
    originX: 0,
    originY: 0,
    width: 1000,
    height: 1000,
  });
});

test('landscape image crops the centered square', () => {
  const input = {
    imageWidth: 2000,
    imageHeight: 1000,
    viewport: 300,
    transform: transform(),
  };
  assert.deepEqual(computeCropRect(input), {
    originX: 500,
    originY: 0,
    width: 1000,
    height: 1000,
  });
});

test('zooming halves the crop size and stays centered', () => {
  const input = {
    imageWidth: 2000,
    imageHeight: 1000,
    viewport: 300,
    transform: transform(2),
  };
  assert.deepEqual(computeCropRect(input), {
    originX: 750,
    originY: 250,
    width: 500,
    height: 500,
  });
});

test('pan clamps to the image edges', () => {
  const right = {
    imageWidth: 2000,
    imageHeight: 1000,
    viewport: 300,
    transform: transform(1, 2000, 0),
  };
  assert.deepEqual(clampTransform(right), transform(1, 150, 0));
  assert.deepEqual(computeCropRect(right), {
    originX: 0,
    originY: 0,
    width: 1000,
    height: 1000,
  });

  const left = {
    ...right,
    transform: transform(1, -2000, 0),
  };
  assert.deepEqual(clampTransform(left), transform(1, -150, 0));
  assert.deepEqual(computeCropRect(left), {
    originX: 1000,
    originY: 0,
    width: 1000,
    height: 1000,
  });
});

test('scale below 1 clamps to 1', () => {
  const input = {
    imageWidth: 2000,
    imageHeight: 1000,
    viewport: 300,
    transform: transform(0.5, 500, 500),
  };
  assert.deepEqual(clampTransform(input), transform(1, 150, 0));
  assert.deepEqual(computeCropRect(input), {
    originX: 0,
    originY: 0,
    width: 1000,
    height: 1000,
  });
});

test('keeps the crop rect inside an odd-sized image at the edge', () => {
  const rect = computeCropRect({
    imageWidth: 1001,
    imageHeight: 1001,
    viewport: 300,
    transform: { scale: 2, translateX: 10000, translateY: 0 },
  });
  assert.ok(rect.originX >= 0);
  assert.ok(rect.originY >= 0);
  assert.ok(rect.originX + rect.width <= 1001);
  assert.ok(rect.originY + rect.height <= 1001);
});
