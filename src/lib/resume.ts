export type ResumeState = {
  trackId: string;
  positionMs: number;
};

export function isResumeState(value: unknown): value is ResumeState {
  if (typeof value !== 'object' || value === null) return false;
  const { trackId, positionMs } = value as Record<string, unknown>;
  return (
    typeof trackId === 'string' &&
    trackId.trim().length > 0 &&
    typeof positionMs === 'number' &&
    Number.isFinite(positionMs) &&
    positionMs >= 0
  );
}

export function serializeResume(state: ResumeState): string {
  if (!isResumeState(state)) throw new TypeError('Invalid resume state');
  return JSON.stringify({ trackId: state.trackId, positionMs: Math.round(state.positionMs) });
}

export function parseResume(raw: string | null | undefined): ResumeState | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isResumeState(parsed)) return null;
    return { trackId: parsed.trackId, positionMs: Math.round(parsed.positionMs) };
  } catch {
    return null;
  }
}
