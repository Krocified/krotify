export const SLEEP_PRESETS = [15, 30, 45, 60, 'end'] as const;

export type SleepPreset = (typeof SLEEP_PRESETS)[number];

const FADE_MS = 10_000;

export type SleepTick = {
  remainingMs: number;
  fadeFrom: number | null;
  done: boolean;
};

export function tickSleep(remainingMs: number, elapsedMs: number): SleepTick {
  const remaining = Math.max(0, remainingMs - Math.max(0, elapsedMs));
  if (remaining === 0) return { remainingMs: 0, fadeFrom: null, done: true };
  const fadeFrom = remaining <= FADE_MS ? remaining / FADE_MS : null;
  return { remainingMs: remaining, fadeFrom, done: false };
}
