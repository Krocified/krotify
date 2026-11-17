import { parseLyricsInput } from '../lib/lyricsInput.ts';
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


export async function importLyricsText(
  trackId: string,
  rawText: string,
  write: LyricsCacheWriter = defaultWriter,
): Promise<LyricsImportResult> {
  const parsed = parseLyricsInput(rawText);
  const kind: LyricsKind = parsed.kind;
  await write(trackId, { kind, text: parsed.text });
  return { kind, lineCount: parsed.lineCount };
}

export async function pickLyricsFile(): Promise<{ text: string; name: string } | null> {
  const DocumentPicker = await import('expo-document-picker');
  const { File } = await import('expo-file-system');
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;

  const asset = picked.assets?.[0];
  if (!asset) return null;

  const text = await new File(asset.uri).text();
  return { text, name: asset.name ?? 'lyrics.lrc' };
}
