import { parseLrc, type LrcLine } from './lrc.ts';

export type LyricsFormat = 'lrc' | 'yaml' | 'plain';

export type ParsedLyricsInput = {
  format: LyricsFormat;
  kind: 'synced' | 'plain';
  text: string;
  lines: LrcLine[];
  lineCount: number;
};

type TimedLine = { atMs: number; text: string };

function withoutBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

export function parseTimestamp(value: string | number): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : null;
  }
  const text = value.trim().replace(/^["']|["']$/g, '');
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = Number(`0.${match[4] ?? '0'}`);
  if (minutes >= 60 || seconds >= 60) return null;
  return Math.round(((hours * 60 + minutes) * 60 + seconds + fraction) * 1000);
}

function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centis = Math.floor((total % 1000) / 10);
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}]`;
}

function splitYamlEntry(line: string): { key: string; value: string } | null {
  const match = line.match(/^\s*(?:-\s*)?([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  if (!match) return null;
  return { key: match[1].toLowerCase(), value: match[2].trim() };
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim();
}

function looksLikeYaml(raw: string): boolean {
  return /^\s*(?:lines|lyrics)\s*:/im.test(raw) || /^\s*-\s*(?:time|at|start|offset)\s*:/im.test(raw);
}

function parseYamlLyrics(raw: string): TimedLine[] {
  const lines: TimedLine[] = [];
  let current: { atMs: number | null; text: string } | null = null;
  let offsetMs = 0;

  const flush = () => {
    if (!current) return;
    if (current.atMs !== null && current.text.trim()) {
      lines.push({ atMs: Math.max(0, current.atMs + offsetMs), text: current.text.trim() });
    }
    current = null;
  };

  for (const rawLine of raw.split(/\r?\n|\r/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^\s*(?:lines|lyrics)\s*:\s*$/.test(rawLine)) continue;

    const startsItem = /^\s*-\s*/.test(rawLine);
    if (startsItem || !current) {
      if (startsItem) flush();
      if (!current) current = { atMs: null, text: '' };
    }

    const entry = splitYamlEntry(rawLine);
    if (!entry) continue;
    const value = unquote(entry.value);

    if (entry.key === 'offset' || entry.key === 'offsetms') {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        offsetMs = entry.key === 'offsetms' ? Math.round(numeric) : Math.round(numeric * 1000);
      }
      continue;
    }
    if (entry.key === 'time' || entry.key === 'at' || entry.key === 'start') {
      const atMs = parseTimestamp(value);
      if (atMs !== null) current = { atMs, text: current?.text ?? '' };
      continue;
    }
    if (entry.key === 'text' || entry.key === 'line' || entry.key === 'lyric') {
      if (!current) current = { atMs: null, text: '' };
      current.text = value;
    }
  }
  flush();

  return lines
    .filter((line) => line.text.length > 0)
    .sort((left, right) => left.atMs - right.atMs);
}

export function parseLyricsInput(raw: string): ParsedLyricsInput {
  const clean = withoutBom(raw);
  if (!clean.trim()) throw new Error('Paste some lyrics first.');

  const lrc = parseLrc(clean);
  if (lrc.lines.length > 0) {
    return {
      format: 'lrc',
      kind: 'synced',
      text: clean,
      lines: lrc.lines,
      lineCount: lrc.lines.length,
    };
  }

  if (looksLikeYaml(clean)) {
    const yamlLines = parseYamlLyrics(clean);
    if (yamlLines.length === 0) throw new Error('No timed lyrics found in that YAML.');
    const text = yamlLines
      .map((line) => `${formatTimestamp(line.atMs)}${line.text}`)
      .join('\n');
    const parsed = parseLrc(text);
    return {
      format: 'yaml',
      kind: 'synced',
      text,
      lines: parsed.lines,
      lineCount: parsed.lines.length,
    };
  }

  const hasContent = clean
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !/^\[[^\]]+:[^\]]*\]$/.test(line));
  if (!hasContent) throw new Error('That file has no lyrics.');

  return { format: 'plain', kind: 'plain', text: clean, lines: [], lineCount: 0 };
}
