import { useAudioPlayerStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { mockTick } from '../lib/mockClock';
import { nextIndex, previousIndex } from '../lib/queue';
import type { Track } from '../types';
import { audioPlayer, configureAudio, pauseAudio, playAudio, seekAudio } from './audioEngine';

export type PlayerContextValue = {
  track: Track | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  lastError: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  playTrack: (
    track: Track,
    resolveUri: (track: Track) => Promise<string>,
    queue?: Track[],
  ) => Promise<boolean>;
  toggle: () => void;
  seek: (positionMs: number) => Promise<void>;
  next: () => void;
  previous: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: PropsWithChildren) {
  const status = useAudioPlayerStatus(audioPlayer);
  const [track, setTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [mode, setMode] = useState<'audio' | 'mock' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mockPlaying, setMockPlaying] = useState(false);
  const [mockPosition, setMockPosition] = useState(0);
  const [mockRunId, setMockRunId] = useState(0);
  const requestRef = useRef(0);
  const lastHandledErrorRef = useRef<string | null>(null);
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveUriRef = useRef<((track: Track) => Promise<string>) | null>(null);

  const clearMockTimer = useCallback(() => {
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    configureAudio().catch(() => setLastError('Could not start audio session'));
    return clearMockTimer;
  }, [clearMockTimer]);

  useEffect(() => {
    if (mode !== 'mock' || !mockPlaying || !track) return;
    const durationMs = track.durationMs;
    mockTimerRef.current = setInterval(() => {
      setMockPosition((position) => {
        const next = mockTick(position, 250, durationMs);
        if (next.finished) setMockPlaying(false);
        return next.positionMs;
      });
    }, 250);
    return clearMockTimer;
  }, [mode, mockPlaying, track, mockRunId, clearMockTimer]);

  useEffect(() => {
    if (mode === 'audio' && status.didJustFinish) pauseAudio();
  }, [mode, status.didJustFinish]);

  useEffect(() => {
    if (mode !== 'audio' || status.error === null) return;
    if (lastHandledErrorRef.current === status.error) return;
    lastHandledErrorRef.current = status.error;
    setLastError('Could not play this file');
    pauseAudio();
  }, [mode, status.error]);

  const playTrack = useCallback(
    async (
      nextTrack: Track,
      resolveUri: (track: Track) => Promise<string>,
      nextQueue: Track[] = [nextTrack],
    ): Promise<boolean> => {
      const requestId = ++requestRef.current;
      resolveUriRef.current = resolveUri;
      const targetIndex = nextQueue.findIndex((item) => item.id === nextTrack.id);

      if (nextTrack.source === 'demo') {
        pauseAudio();
        setMode('mock');
        setMockPosition(0);
        setMockPlaying(true);
        setTrack(nextTrack);
        setQueue(nextQueue);
        setIndex(targetIndex >= 0 ? targetIndex : 0);
        setLastError(null);
        return true;
      }

      try {
        const uri = await resolveUri(nextTrack);
        if (requestId !== requestRef.current) return false;
        await playAudio(uri, nextTrack);
        setMode('audio');
        setTrack(nextTrack);
        setQueue(nextQueue);
        setIndex(targetIndex >= 0 ? targetIndex : 0);
        setLastError(null);
        return true;
      } catch {
        if (requestId !== requestRef.current) return false;
        setLastError('Could not play this file');
        return false;
      }
    },
    [],
  );

  const toggle = useCallback(() => {
    if (mode === 'mock') {
      setMockPlaying((playing) => !playing);
    } else if (audioPlayer.playing) {
      pauseAudio();
    } else {
      audioPlayer.play();
    }
  }, [mode]);

  const seek = useCallback(
    async (positionMs: number): Promise<void> => {
      if (mode === 'mock') {
        setMockPosition(positionMs);
        setMockRunId((id) => id + 1);
        return;
      }
      await seekAudio(positionMs);
    },
    [mode],
  );

  const next = useCallback(() => {
    const target = nextIndex(index, queue.length);
    if (target === -1) return;
    const nextTrack = queue[target];
    const resolveUri = resolveUriRef.current;
    if (!nextTrack || !resolveUri) return;
    void playTrack(nextTrack, resolveUri, queue);
  }, [index, queue, playTrack]);

  const previous = useCallback(() => {
    const target = previousIndex(index, queue.length);
    if (target === -1) return;
    const previousTrack = queue[target];
    const resolveUri = resolveUriRef.current;
    if (!previousTrack || !resolveUri) return;
    void playTrack(previousTrack, resolveUri, queue);
  }, [index, queue, playTrack]);

  const hasNext = nextIndex(index, queue.length) !== -1;
  const hasPrevious = previousIndex(index, queue.length) !== -1;

  const isPlaying = mode === 'mock' ? mockPlaying : status.playing;
  const positionMs = mode === 'mock' ? mockPosition : Math.round(status.currentTime * 1000);
  const durationMs =
    mode === 'mock'
      ? (track?.durationMs ?? 0)
      : Math.round((status.duration || (track?.durationMs ?? 0) / 1000) * 1000);

  const value = useMemo<PlayerContextValue>(
    () => ({
      track,
      isPlaying,
      positionMs,
      durationMs,
      lastError,
      hasNext,
      hasPrevious,
      playTrack,
      toggle,
      seek,
      next,
      previous,
    }),
    [
      track,
      isPlaying,
      positionMs,
      durationMs,
      lastError,
      hasNext,
      hasPrevious,
      playTrack,
      toggle,
      seek,
      next,
      previous,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}
