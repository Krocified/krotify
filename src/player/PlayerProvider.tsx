import { useAudioPlayerStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { mockTick } from '../lib/mockClock';
import { isAtEnd, nextIndex, previousAction } from '../lib/queue';
import type { Track } from '../types';
import { audioPlayer, configureAudio, pauseAudio, playAudio, seekAudio, stopAudio } from './audioEngine';

export type RepeatMode = 'off' | 'all' | 'one';

export type PlayerContextValue = {
  track: Track | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  lastError: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  queueLength: number;
  repeat: RepeatMode;
  cycleRepeat: () => void;
  playTrack: (
    track: Track,
    resolveUri: (track: Track) => Promise<string>,
    queue?: Track[],
  ) => Promise<boolean>;
  toggle: () => void;
  seek: (positionMs: number) => Promise<void>;
  stop: () => void;
  next: () => void;
  previous: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  removeFromQueue: (ids: string[]) => void;
  setQueue: (queue: Track[]) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: PropsWithChildren) {
  const status = useAudioPlayerStatus(audioPlayer);
  const [track, setTrack] = useState<Track | null>(null);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [mode, setMode] = useState<'audio' | 'mock' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mockPlaying, setMockPlaying] = useState(false);
  const [mockPosition, setMockPosition] = useState(0);
  const [mockRunId, setMockRunId] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const requestRef = useRef(0);
  const lastHandledErrorRef = useRef<string | null>(null);
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveUriRef = useRef<((track: Track) => Promise<string>) | null>(null);
  const endHandledForRef = useRef<string | null>(null);
  const wasFinishedRef = useRef(false);

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
      endHandledForRef.current = null;
      resolveUriRef.current = resolveUri;
      const targetIndex = nextQueue.findIndex((item) => item.id === nextTrack.id);

      if (nextTrack.source === 'demo') {
        pauseAudio();
        setMode('mock');
        setMockPosition(0);
        setMockPlaying(true);
        setTrack(nextTrack);
        setQueueState(nextQueue);
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
        setQueueState(nextQueue);
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

  const seek = useCallback(
    async (positionMs: number): Promise<void> => {
      endHandledForRef.current = null;
      if (mode === 'mock') {
        setMockPosition(positionMs);
        setMockRunId((id) => id + 1);
        return;
      }
      await seekAudio(positionMs);
    },
    [mode],
  );

  const isPlaying = mode === 'mock' ? mockPlaying : status.playing;
  const positionMs = mode === 'mock' ? mockPosition : Math.round(status.currentTime * 1000);
  const durationMs =
    mode === 'mock'
      ? (track?.durationMs ?? 0)
      : Math.round((status.duration || (track?.durationMs ?? 0) / 1000) * 1000);

  const toggle = useCallback(() => {
    const atEnd = isAtEnd(positionMs, durationMs);
    if (mode === 'mock') {
      if (atEnd) {
        endHandledForRef.current = null;
        setMockPosition(0);
        setMockRunId((id) => id + 1);
        setMockPlaying(true);
        return;
      }
      setMockPlaying((playing) => !playing);
      return;
    }
    if (atEnd) {
      endHandledForRef.current = null;
      void audioPlayer.seekTo(0);
      audioPlayer.play();
      return;
    }
    if (audioPlayer.playing) pauseAudio();
    else audioPlayer.play();
  }, [mode, positionMs, durationMs]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    stopAudio();
    clearMockTimer();
    setMode(null);
    setTrack(null);
    setQueueState([]);
    setIndex(-1);
    setMockPlaying(false);
    setMockPosition(0);
    setLastError(null);
    lastHandledErrorRef.current = null;
  }, [clearMockTimer]);

  const removeFromQueue = useCallback(
    (ids: string[]): void => {
      if (ids.length === 0) return;
      const removed = new Set(ids);
      if (!queue.some((item) => removed.has(item.id))) return;
      const filtered = queue.filter((item) => !removed.has(item.id));
      setQueueState(filtered);
      const current = queue[index];
      if (!current || removed.has(current.id)) {
        setIndex(-1);
        return;
      }
      setIndex(filtered.findIndex((item) => item.id === current.id));
    },
    [queue, index],
  );

  const setQueue = useCallback(
    (nextQueue: Track[]): void => {
      setQueueState(nextQueue);
      setIndex(track ? nextQueue.findIndex((item) => item.id === track.id) : -1);
    },
    [track],
  );

  const canWrap = repeat === 'all' && queue.length > 1;
  const nextTarget = nextIndex(index, queue.length);
  const wrappedNext = canWrap && index === queue.length - 1 ? 0 : nextTarget;
  const previousResult = previousAction(positionMs, index, queue.length);
  const wrapPrevious = canWrap && index === 0 && previousResult.type === 'none';

  const next = useCallback(() => {
    if (wrappedNext === -1) return;
    const nextTrack = queue[wrappedNext];
    const resolveUri = resolveUriRef.current;
    if (!nextTrack || !resolveUri) return;
    void playTrack(nextTrack, resolveUri, queue);
  }, [wrappedNext, queue, playTrack]);

  const previous = useCallback(() => {
    if (previousResult.type === 'restart') {
      void seek(0);
      return;
    }
    const target = previousResult.type === 'previous' ? previousResult.index : wrapPrevious ? queue.length - 1 : -1;
    if (target === -1) return;
    const previousTrack = queue[target];
    const resolveUri = resolveUriRef.current;
    if (!previousTrack || !resolveUri) return;
    void playTrack(previousTrack, resolveUri, queue);
  }, [previousResult, wrapPrevious, queue, playTrack, seek]);

  const skipNext = useCallback(() => {
    if (queue.length < 2) return;
    const current = index < 0 ? 0 : index;
    const target = (current + 1) % queue.length;
    const nextTrack = queue[target];
    const resolveUri = resolveUriRef.current;
    if (!nextTrack || !resolveUri) return;
    void playTrack(nextTrack, resolveUri, queue);
  }, [index, queue, playTrack]);

  const skipPrevious = useCallback(() => {
    if (queue.length < 2) return;
    const current = index < 0 ? 0 : index;
    const target = (current - 1 + queue.length) % queue.length;
    const previousTrack = queue[target];
    const resolveUri = resolveUriRef.current;
    if (!previousTrack || !resolveUri) return;
    void playTrack(previousTrack, resolveUri, queue);
  }, [index, queue, playTrack]);

  const hasNext = wrappedNext !== -1;
  const hasPrevious = previousResult.type !== 'none' || wrapPrevious;
  const queueLength = queue.length;

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
  }, []);

  const handleEnd = useCallback(() => {
    if (!track || endHandledForRef.current === track.id) return;
    endHandledForRef.current = track.id;
    const resolveUri = resolveUriRef.current;
    if (repeat === 'one') {
      if (resolveUri) void playTrack(track, resolveUri, queue);
      return;
    }
    if (track.durationMs > 0 && track.durationMs < 3000) {
      pauseAudio();
      setMockPlaying(false);
      return;
    }
    if (repeat === 'all') {
      const target = index + 1 < queue.length ? index + 1 : 0;
      const nextTrack = queue[target];
      if (nextTrack && resolveUri) void playTrack(nextTrack, resolveUri, queue);
      return;
    }
    if (!hasNext) {
      pauseAudio();
      setMockPlaying(false);
      return;
    }
    const nextTrack = queue[index + 1];
    if (nextTrack && resolveUri) void playTrack(nextTrack, resolveUri, queue);
  }, [track, hasNext, queue, index, playTrack, repeat]);

  useEffect(() => {
    const finished = mode === 'audio' && status.didJustFinish;
    if (finished && !wasFinishedRef.current) handleEnd();
    wasFinishedRef.current = finished;
  }, [mode, status.didJustFinish, handleEnd]);

  useEffect(() => {
    if (mode !== 'mock' || !track || track.durationMs <= 0) return;
    if (mockPlaying || !isAtEnd(mockPosition, track.durationMs)) return;
    const timer = setTimeout(handleEnd, 0);
    return () => clearTimeout(timer);
  }, [mode, mockPlaying, mockPosition, track, handleEnd]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      track,
      isPlaying,
      positionMs,
      durationMs,
      lastError,
      hasNext,
      hasPrevious,
      queueLength,
      repeat,
      cycleRepeat,
      playTrack,
      toggle,
      seek,
      next,
      previous,
      skipNext,
      skipPrevious,
      stop,
      removeFromQueue,
      setQueue,
    }),
    [
      track,
      isPlaying,
      positionMs,
      durationMs,
      lastError,
      hasNext,
      hasPrevious,
      queueLength,
      repeat,
      cycleRepeat,
      playTrack,
      toggle,
      seek,
      next,
      previous,
      skipNext,
      skipPrevious,
      stop,
      removeFromQueue,
      setQueue,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}
