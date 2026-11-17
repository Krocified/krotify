import { parseLrc } from '../lib/lrc.ts';
import type { LyricsKind } from '../db/repo.ts';

export type LyricsImportResult = { kind: LyricsKind; lineCount: number };

export type LyricsCacheWriter = (
  trackId: string,
  lyrics: { kind: LyricsKind; text?: string },
) => Promise<void>;

async function defaultWriter(
  trackId: string,
  lyrics: { kind: LyricsKind; text?: string },
): Promise<void> {
  const { putCachedLyrics } = await import('../db/repo.ts');
  await putCachedLyrics(trackId, lyrics);
}

function hasLyricContent(rawText: string): boolean {
  return rawText
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !/^\[[^\]]+:[^\]]*\]$/.test(line));
}

export async function importLyricsText(
  trackId: string,
  rawText: string,
  write: LyricsCacheWriter = defaultWriter,
): Promise<LyricsImportResult> {
  const parsed = parseLrc(rawText);
  if (!hasLyricContent(rawText)) throw new Error('That file has no lyrics.');
  const kind: LyricsKind = parsed.lines.length > 0 ? 'synced' : 'plain';
  await write(trackId, { kind, text: rawText });
  return { kind, lineCount: parsed.lines.length };
}

export async function pickLyricsFile(): Promise<{ text: string; name: string } | null> {
  const { File } = await import('expo-file-system');
  const picked = await File.pickFileAsync({
    mimeTypes: ['text/plain', 'application/octet-stream'],
  });
  if (picked.canceled) return null;

  const file = picked.result;
  if (!file.name.toLowerCase().endsWith('.lrc')) throw new Error('Pick a .lrc file.');
  return { text: await file.text(), name: file.name };
}
