export const DEFAULT_WINDOW_RADIUS = 5;

export const AHEAD_MIN = 3;

export type PlaylistWindow = {
  start: number;
  end: number;
  localIndex: number;
};

export function playlistWindow(
  index: number,
  length: number,
  radius = DEFAULT_WINDOW_RADIUS,
): PlaylistWindow {
  if (length <= 0) return { start: 0, end: -1, localIndex: -1 };
  const clamped = Math.min(Math.max(index, 0), length - 1);
  const start = Math.max(0, clamped - radius);
  const end = Math.min(length - 1, clamped + radius);
  return { start, end, localIndex: clamped - start };
}

export function nextWindowSize(
  currentLocal: number,
  trackCount: number,
  queueLength: number,
  windowStart: number,
  radius = DEFAULT_WINDOW_RADIUS,
): number {
  if (trackCount <= 0 || currentLocal < 0 || currentLocal >= trackCount) return 0;
  const ahead = trackCount - 1 - currentLocal;
  const missing = Math.max(0, AHEAD_MIN - ahead);
  const remaining = Math.max(0, queueLength - (windowStart + trackCount));
  return Math.min(missing, remaining, radius);
}

export type AppendRange = {
  from: number;
  to: number;
  count: number;
};

export function nextAppendRange(
  globalIndexes: number[],
  trackCount: number,
  queueLength: number,
  currentLocal: number,
  radius = DEFAULT_WINDOW_RADIUS,
): AppendRange {
  const lastLoaded = globalIndexes[globalIndexes.length - 1];
  if (lastLoaded === undefined || trackCount <= 0) return { from: 0, to: -1, count: 0 };
  const from = lastLoaded + 1;
  const count = nextWindowSize(
    currentLocal,
    trackCount,
    queueLength,
    from - trackCount,
    radius,
  );
  const to = Math.min(queueLength - 1, from + count - 1);
  return { from, to, count: to >= from ? to - from + 1 : 0 };
}

export function wrapTarget(
  previousGlobal: number,
  queueLength: number,
  direction: 'forward' | 'backward',
): number {
  if (queueLength <= 0 || previousGlobal < 0) return -1;
  if (direction === 'forward') {
    return previousGlobal + 1 < queueLength ? previousGlobal + 1 : 0;
  }
  return previousGlobal > 0 ? previousGlobal - 1 : queueLength - 1;
}
