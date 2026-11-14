import { useEffect, useState } from 'react';
import type { LrcLine } from '../lib/lrc';
import type { Track } from '../types';
import { loadLyrics } from './lyrics';
import { loadLyricsNetworkEnabled } from './lyricsPrefs';

export type LyricsState = 'idle' | 'loading' | 'ready' | 'none' | 'error';

export type LyricsResult = {
  state: LyricsState;
  lines: LrcLine[];
  plain?: string;
};

const IDLE: LyricsResult = { state: 'idle', lines: [] };
const LOADING: LyricsResult = { state: 'loading', lines: [] };

type StoredLyrics = LyricsResult & { trackId: string | null };

export function useLyrics(track: Track | null, request = true): LyricsResult {
  const [stored, setStored] = useState<StoredLyrics>({ trackId: null, ...IDLE });
  const trackId = request && track ? track.id : null;

  useEffect(() => {
    if (!track || !request) return;

    let cancelled = false;
    void (async () => {
      try {
        const allowNetwork = await loadLyricsNetworkEnabled();
        if (cancelled) return;
        const loaded = await loadLyrics(track, { allowNetwork });
        if (cancelled) return;
        if (loaded.kind === 'synced') {
          setStored({ trackId: track.id, state: 'ready', lines: loaded.lines });
        } else if (loaded.kind === 'plain') {
          setStored({ trackId: track.id, state: 'ready', lines: [], plain: loaded.text });
        } else {
          setStored({ trackId: track.id, state: 'none', lines: [] });
        }
      } catch {
        if (!cancelled) setStored({ trackId: track.id, state: 'error', lines: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [track, request]);

  if (trackId === null) return IDLE;
  if (stored.trackId !== trackId) return LOADING;
  return { state: stored.state, lines: stored.lines, plain: stored.plain };
}
