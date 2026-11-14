import type { Track } from '../types';
import { parseLrc, type LrcLine } from '../lib/lrc.ts';
import {
  fetchLrclibLyrics,
  type LrclibLyrics,
  type LrclibOptions,
} from './lrclib.ts';

export type LyricsSource = 'sidecar' | 'lrclib';

export type LoadedLyrics = {
  kind: 'synced' | 'plain' | 'instrumental' | 'none';
  text?: string;
  lines: LrcLine[];
  offsetMs: number;
  source?: LyricsSource;
};

export type LoadLyricsOptions = {
  allowNetwork?: boolean;
  lrclib?: LrclibOptions;
  findFile?: FindLyricsFile;
  readFile?: (uri: string) => Promise<string | null>;
};

export type FindLyricsFile = (track: Track) => Promise<string | null>;

function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export async function findLyricsFile(track: Track): Promise<string | null> {
  if (!track.uri) return null;
  try {
    const { Directory, File } = await import('expo-file-system');
    const audio = new File(track.uri);
    const name = baseName(audio.name);
    if (!name) return null;

    const sibling = new File(audio.parentDirectory, `${name}.lrc`);
    if (sibling.exists) return sibling.uri;

    const nested = new File(new Directory(audio.parentDirectory, 'Lyrics'), `${name}.lrc`);
    if (nested.exists) return nested.uri;
  } catch {
  }
  return null;
}

export async function readLyricsFile(uri: string): Promise<string | null> {
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (!file.exists) return null;
    return await file.text();
  } catch {
    return null;
  }
}

function fromText(text: string, source: LyricsSource): LoadedLyrics {
  if (!text.trim()) return { kind: 'none', lines: [], offsetMs: 0 };

  const parsed = parseLrc(text);
  if (parsed.lines.length > 0) {
    return {
      kind: 'synced',
      text,
      lines: parsed.lines,
      offsetMs: parsed.offsetMs,
      source,
    };
  }

  return { kind: 'plain', text, lines: [], offsetMs: parsed.offsetMs, source };
}

function fromLrclib(result: LrclibLyrics): LoadedLyrics {
  if (result.kind === 'synced' && result.text) return fromText(result.text, 'lrclib');
  if (result.kind === 'plain' && result.text) {
    return { kind: 'plain', text: result.text, lines: [], offsetMs: 0, source: 'lrclib' };
  }
  return { kind: result.kind, lines: [], offsetMs: 0, source: result.kind === 'none' ? undefined : 'lrclib' };
}

export async function loadLyrics(
  track: Track,
  options: LoadLyricsOptions = {},
): Promise<LoadedLyrics> {
  const findFile = options.findFile ?? findLyricsFile;
  const sidecar = await findFile(track);
  if (sidecar) {
    const readFile = options.readFile ?? readLyricsFile;
    const text = await readFile(sidecar);
    if (text !== null) return fromText(text, 'sidecar');
  }

  const result = await fetchLrclibLyrics(
    {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationMs: track.durationMs,
    },
    {
      ...options.lrclib,
      allowNetwork: options.allowNetwork ?? options.lrclib?.allowNetwork,
    },
  );

  return fromLrclib(result);
}

export async function lyricsCacheCount(): Promise<number> {
  try {
    const { countCachedLyrics } = await import('../db/repo');
    return await countCachedLyrics();
  } catch {
    return 0;
  }
}
