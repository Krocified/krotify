export type LockScreenSignal = {
  isActive: boolean;
  isLoaded: boolean;
  durationMs: number;
  trackId: string;
  reassertedTrackId: string | null;
};

export function needsLockScreenReassert(signal: LockScreenSignal): boolean {
  return (
    signal.isActive &&
    signal.isLoaded &&
    Number.isFinite(signal.durationMs) &&
    signal.durationMs > 0 &&
    signal.reassertedTrackId !== signal.trackId
  );
}
