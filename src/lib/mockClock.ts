export function mockTick(
  positionMs: number,
  elapsedMs: number,
  durationMs: number,
): { positionMs: number; finished: boolean } {
  const position = Math.max(0, Math.min(durationMs, positionMs + elapsedMs));
  return { positionMs: position, finished: position >= durationMs };
}
