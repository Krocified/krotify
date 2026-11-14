export type LrcLine = { atMs: number; text: string };

export type ParsedLrc = { lines: LrcLine[]; offsetMs: number };

const TIMESTAMP = /^(\d+):(\d{1,2})(?:[.:](\d{1,3}))?$/;
const TAG = /^([a-z]+)\s*:(.*)$/i;

function parseTimestamp(value: string): number | null {
  const match = TIMESTAMP.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds >= 60) return null;
  const fraction = match[3] ?? '';
  const milliseconds = fraction ? Number(fraction.padEnd(3, '0')) : 0;
  return minutes * 60_000 + seconds * 1_000 + milliseconds;
}

export function parseLrc(text: string): ParsedLrc {
  if (!text) return { lines: [], offsetMs: 0 };

  const rawLines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const lines: LrcLine[] = [];
  let offsetMs = 0;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const stamps: number[] = [];
    let rest = trimmed;

    while (rest.startsWith('[')) {
      const end = rest.indexOf(']');
      if (end < 0) break;
      const inner = rest.slice(1, end).trim();
      rest = rest.slice(end + 1);

      const stamp = parseTimestamp(inner);
      if (stamp !== null) {
        stamps.push(stamp);
        continue;
      }

      const tag = TAG.exec(inner);
      if (tag && tag[1].toLowerCase() === 'offset') {
        const parsed = Number.parseInt(tag[2].trim(), 10);
        if (Number.isFinite(parsed)) offsetMs = parsed;
      }
    }

    if (stamps.length === 0) continue;
    const content = rest.trim();
    if (!content) continue;

    for (const atMs of stamps) lines.push({ atMs, text: content });
  }

  lines.sort((a, b) => a.atMs - b.atMs);
  if (offsetMs !== 0) {
    for (const line of lines) line.atMs += offsetMs;
  }

  return { lines, offsetMs };
}
