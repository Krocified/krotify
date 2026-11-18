import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSinePath, sinePath, mirroredPath } from '../src/lib/waveGeometry.ts';

const base = { width: 800, height: 64, periods: 3, amplitude: 10, phase: 0 };

test('paths start with M and use finite numbers', () => {
  for (const d of [sinePath(base), mirroredPath(base)]) {
    assert.ok(d.startsWith('M'));
    assert.ok(!d.includes('NaN'));
    assert.ok(!d.includes('Infinity'));
  }
});

test('paths scale with amplitude and periods', () => {
  assert.notEqual(sinePath(base), sinePath({ ...base, periods: 5 }));
  assert.notEqual(sinePath(base), sinePath({ ...base, amplitude: 20 }));
  assert.notEqual(mirroredPath(base), mirroredPath({ ...base, amplitude: 20 }));
});

test('paths shift with phase', () => {
  assert.notEqual(sinePath(base), sinePath({ ...base, phase: Math.PI / 2 }));
});

test('openSinePath starts with M and stays open', () => {
  const d = openSinePath(base);
  assert.ok(d.startsWith('M'));
  assert.ok(!d.includes('Z'));
});

test('openSinePath has no L commands', () => {
  assert.ok(!openSinePath(base).split(' ').includes('L'));
});

test('openSinePath spans full amplitude range around centerY at phase 0', () => {
  const centerY = base.height / 2;
  const yValues = vertices(openSinePath({ ...base, phase: 0 })).map((point) => point.y);
  assert.ok(Math.abs(Math.min(...yValues) - (centerY - base.amplitude)) < 0.05);
  assert.ok(Math.abs(Math.max(...yValues) - (centerY + base.amplitude)) < 0.05);
});

type Vertex = { x: number; y: number };

const vertices = (d: string): Vertex[] => {
  const tokens = d.split(' ');
  const points: Vertex[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === 'M' || cmd === 'L') {
      points.push({ x: Number(tokens[i + 1]), y: Number(tokens[i + 2]) });
      i += 3;
    } else if (cmd === 'C') {
      points.push({ x: Number(tokens[i + 5]), y: Number(tokens[i + 6]) });
      i += 7;
    } else {
      i += 1;
    }
  }
  return points;
};

const enclosedArea = (points: Vertex[]): number => {
  const n = points.length;
  const half = n / 2;
  let sum = 0;
  for (let i = 0; i < half - 1; i++) {
    const widthA = Math.abs(points[i].y - points[n - 1 - i].y);
    const widthB = Math.abs(points[i + 1].y - points[n - 2 - i].y);
    sum += ((points[i + 1].x - points[i].x) * (widthA + widthB)) / 2;
  }
  return sum;
};

test('mirroredPath separates edges by 2·amplitude·|sin| at lobe peaks', () => {
  for (const phase of [0, Math.PI / 2]) {
    const peakX = phase === 0 ? base.width / (4 * base.periods) : base.width / (2 * base.periods);
    const expected =
      2 * base.amplitude * Math.abs(Math.sin((2 * Math.PI * base.periods * peakX) / base.width + phase));
    const atPeak = vertices(mirroredPath({ ...base, phase })).filter((p) => Math.abs(p.x - peakX) < 0.05);
    assert.equal(atPeak.length, 2);
    const separation = Math.abs(atPeak[0].y - atPeak[1].y);
    assert.ok(
      Math.abs(separation - expected) < 0.05,
      `phase ${phase}: separation ${separation}, expected ${expected}`,
    );
  }
});

test('mirroredPath encloses nonzero area', () => {
  for (const phase of [0, Math.PI / 2]) {
    const pts = vertices(mirroredPath({ ...base, phase }));
    assert.ok(enclosedArea(pts) > 100, `phase ${phase}: area ${enclosedArea(pts)} too small`);
  }
});
