export type WavePathInput = {
  width: number;
  height: number;
  periods: number;
  amplitude: number;
  phase: number;
};

const K = 0.3642;
const SAMPLES_PER_PERIOD = 8;

type Point = { x: number; y: number };

const round = (value: number): number => Math.round(value * 100) / 100;

const num = (value: number): string => String(round(value));

const centerYOf = (input: WavePathInput): number => input.height / 2;

const sineY = (input: WavePathInput, x: number): number =>
  centerYOf(input) -
  input.amplitude * Math.sin((2 * Math.PI * input.periods * x) / input.width + input.phase);

const samplePoints = (input: WavePathInput): Point[] => {
  const count = Math.max(1, Math.round(input.periods)) * SAMPLES_PER_PERIOD;
  const points: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * input.width;
    points.push({ x, y: sineY(input, x) });
  }
  return points;
};

const cubicSegments = (points: Point[]): string[] => {
  const segments: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const dx = p1.x - p0.x;
    segments.push(
      `C ${num(p0.x + K * dx)} ${num(p0.y)} ${num(p1.x - K * dx)} ${num(p1.y)} ${num(p1.x)} ${num(p1.y)}`,
    );
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
  const points = samplePoints(input);
  const first = points[0];
  const last = points[points.length - 1];
  const centerY = centerYOf(input);
  const bottom = [...points].reverse();
  const bottomLast = bottom[bottom.length - 1];
  return [
    move(first),
    ...cubicSegments(points),
    lineTo(last.x, centerY),
    ...cubicSegments(bottom),
    lineTo(bottomLast.x, centerY),
    'Z',
  ].join(' ');
}
