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
