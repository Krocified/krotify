import { useCallback, useEffect, useState } from 'react';
import type { LrcLine } from '../lib/lrc';
import type { Track } from '../types';
import { loadLyrics } from './lyrics';

export type LyricsState = 'idle' | 'loading' | 'ready' | 'none' | 'error';

type LyricsData = {
  state: LyricsState;
  lines: LrcLine[];
  plain?: string;
};

export type LyricsResult = LyricsData & {
  reload: () => void;
};

const IDLE: LyricsData = { state: 'idle', lines: [] };
const LOADING: LyricsData = { state: 'loading', lines: [] };

type StoredLyrics = LyricsData & { trackId: string | null };

export function useLyrics(track: Track | null, request = true): LyricsResult {
  const [stored, setStored] = useState<StoredLyrics>({ trackId: null, ...IDLE });
  const [version, setVersion] = useState(0);
  const trackId = request && track ? track.id : null;
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!track || !request) return;

    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadLyrics(track, { allowNetwork: false });
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
  }, [track, request, version]);

  if (trackId === null) return { ...IDLE, reload };
  if (stored.trackId !== trackId) return { ...LOADING, reload };
  return { state: stored.state, lines: stored.lines, plain: stored.plain, reload };
}
