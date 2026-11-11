import type { Track } from '../types';
import { titleFromFilename } from './format.ts';
import { hueFromSeed } from './hash.ts';

export type AssetMeta = { id: string; filename: string; durationMs: number };

export function toTrack(meta: AssetMeta): Track {
  const title = titleFromFilename(meta.filename);
  return {
    id: meta.id,
    uri: '',
    source: 'scan',
    title,
    artist: '',
    album: '',
    durationMs: meta.durationMs,
    artworkHue: hueFromSeed(meta.filename),
  };
}

export function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

export function mergeTracks(existing: Track[], page: Track[]): Track[] {
  const seen = new Set(existing.map((t) => t.id));
  const additions: Track[] = [];
  for (const track of page) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    additions.push(track);
  }
  return [...existing, ...additions];
}

export function tracksFromPage(metas: AssetMeta[]): Track[] {
  return sortTracks(mergeTracks([], metas.map(toTrack)));
}
