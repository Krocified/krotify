export const RESTART_THRESHOLD_MS = 3000;

export type PreviousAction =
  | { type: 'restart' }
  | { type: 'previous'; index: number }
  | { type: 'none' };

export function nextIndex(current: number, length: number): number {
  return current >= 0 && current < length - 1 ? current + 1 : -1;
}

export function previousIndex(current: number, length: number): number {
  return current > 0 && current < length ? current - 1 : -1;
}

export function previousAction(positionMs: number, current: number, length: number): PreviousAction {
  if (positionMs > RESTART_THRESHOLD_MS) return { type: 'restart' };
  const target = previousIndex(current, length);
  return target === -1 ? { type: 'none' } : { type: 'previous', index: target };
}

export function isAtEnd(positionMs: number, durationMs: number, toleranceMs = 250): boolean {
  return durationMs > 0 && positionMs >= durationMs - toleranceMs;
}
