export type WavePathInput = {
  width: number;
  height: number;
  periods: number;
  amplitude: number;
  phase: number;
};

const K = 0.3642;
const SAMPLES_PER_PERIOD = 8;
const TWO_PI = Math.PI * 2;

type Point = { x: number; y: number; slope: number };

const round = (value: number): number => Math.round(value * 100) / 100;

const num = (value: number): string => String(round(value));

const centerYOf = (input: WavePathInput): number => input.height / 2;

const sineAt = (input: WavePathInput, x: number): Point => {
  const angle = (TWO_PI * input.periods * x) / input.width + input.phase;
  return {
    x,
    y: centerYOf(input) - input.amplitude * Math.sin(angle),
    slope: -input.amplitude * ((TWO_PI * input.periods) / input.width) * Math.cos(angle),
  };
};

const samplePoints = (input: WavePathInput): Point[] => {
  const count = Math.max(1, Math.round(input.periods)) * SAMPLES_PER_PERIOD;
  const points: Point[] = [];
  for (let i = 0; i <= count; i++) {
    points.push(sineAt(input, (i / count) * input.width));
  }
  return points;
};

const cubicSegment = (p0: Point, p1: Point): string => {
  const dx = p1.x - p0.x;
  return `C ${num(p0.x + K * dx)} ${num(p0.y + K * dx * p0.slope)} ${num(p1.x - K * dx)} ${num(
    p1.y - K * dx * p1.slope,
  )} ${num(p1.x)} ${num(p1.y)}`;
};

const cubicSegments = (points: Point[]): string[] => {
  const segments: string[] = [];
  for (let i = 1; i < points.length; i++) {
    segments.push(cubicSegment(points[i - 1], points[i]));
  }
  return segments;
};

const move = (point: Point): string => `M ${num(point.x)} ${num(point.y)}`;

const lineTo = (x: number, y: number): string => `L ${num(x)} ${num(y)}`;

export function sinePath(input: WavePathInput): string {
  const points = samplePoints(input);
  const first = points[0];
  const last = points[points.length - 1];
  const centerY = centerYOf(input);
  return [
    move(first),
    ...cubicSegments(points),
    lineTo(last.x, centerY),
    lineTo(first.x, centerY),
    'Z',
  ].join(' ');
}

export function mirroredPath(input: WavePathInput): string {
  const top = samplePoints(input);
  const centerY = centerYOf(input);
  const bottom = [...top]
    .reverse()
    .map((point) => ({ x: point.x, y: 2 * centerY - point.y, slope: -point.slope }));
  const firstTop = top[0];
  return [
    move(firstTop),
    ...cubicSegments(top),
    lineTo(bottom[0].x, bottom[0].y),
    ...cubicSegments(bottom),
    'Z',
  ].join(' ');
}
