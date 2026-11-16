export type WindowEntry = { global: number; uri: string | null };

export type PlayableWindow = {
  playable: { global: number; uri: string }[];
  localIndex: number;
  missingGlobals: number[];
};

export function buildPlayableWindow(
  entries: WindowEntry[],
  targetGlobal: number,
): PlayableWindow {
  const playable: { global: number; uri: string }[] = [];
  const missingGlobals: number[] = [];
  for (const entry of entries) {
    if (entry.uri) {
      playable.push({ global: entry.global, uri: entry.uri });
    } else {
      missingGlobals.push(entry.global);
    }
  }
  const localIndex = playable.findIndex((entry) => entry.global === targetGlobal);
  return { playable, localIndex, missingGlobals };
}

export function nextPlayableIndex(
  length: number,
  from: number,
  playable: ReadonlySet<number>,
  wrap = false,
): number {
  const start = from < 0 ? -1 : from;
  for (let i = start + 1; i < length; i += 1) {
    if (playable.has(i)) return i;
  }
  if (wrap) {
    for (let i = 0; i <= start; i += 1) {
      if (playable.has(i)) return i;
    }
  }
  return -1;
}

export function shouldProbeDuration(durationMs: number, source: string): boolean {
  return durationMs <= 0 && source !== 'demo';
}
