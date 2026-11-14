import { useAudioPlaylistStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { mockTick } from '../lib/mockClock';
import { DEFAULT_WINDOW_RADIUS, nextAppendRange, playlistWindow, wrapTarget } from '../lib/playlistWindow';
import { isAtEnd, nextIndex, previousAction } from '../lib/queue';
import type { Track } from '../types';
import { configureAudio, engine, type WindowTrack } from './audioEngine';

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

type WindowState = {
  globalIndexes: number[];
};

type ResolvedWindowTrack = WindowTrack & { global: number };

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: PropsWithChildren) {
  const status = useAudioPlaylistStatus(engine.playlist);
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
  const loadGenerationRef = useRef(0);
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveUriRef = useRef<((track: Track) => Promise<string>) | null>(null);
  const endHandledForRef = useRef<string | null>(null);
  const queueRef = useRef<Track[]>([]);
  const modeRef = useRef<'audio' | 'mock' | null>(null);
  const repeatRef = useRef<RepeatMode>('off');
  const windowRef = useRef<WindowState>({ globalIndexes: [] });
  const loadedQueueRef = useRef<Track[] | null>(null);
  const appendingRef = useRef(false);

  const clearMockTimer = useCallback(() => {
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    engine.setLoop(repeat === 'off' ? 'none' : repeat === 'one' ? 'single' : 'all');
  }, [repeat]);

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

  const loadWindow = useCallback(
    async (
      targetIndex: number,
      nextQueue: Track[],
      resolveUri: (track: Track) => Promise<string>,
      positionMs = 0,
    ): Promise<boolean> => {
      if (nextQueue.length === 0) return false;
      const generation = ++loadGenerationRef.current;
      const { start, end } = playlistWindow(targetIndex, nextQueue.length, DEFAULT_WINDOW_RADIUS);
      const indexes: number[] = [];
      for (let global = start; global <= end; global += 1) indexes.push(global);
      const entries = await Promise.all(
        indexes.map(async (global): Promise<ResolvedWindowTrack | null> => {
          const item = nextQueue[global];
          if (!item) return null;
          try {
            return { uri: await resolveUri(item), track: item, global };
          } catch {
            return null;
          }
        }),
      );
      if (generation !== loadGenerationRef.current) return false;

      const loaded = entries.filter((entry): entry is ResolvedWindowTrack => entry !== null);
      const local = loaded.findIndex((entry) => entry.global === targetIndex);
      const currentTrack = nextQueue[targetIndex];
      if (local < 0 || !currentTrack) {
        setLastError('Could not play this file');
        return false;
      }

      engine.load(
        loaded.map(({ uri, track: item }) => ({ uri, track: item })),
        local,
        loaded.map((entry) => entry.global),
      );
      windowRef.current = { globalIndexes: loaded.map((entry) => entry.global) };
      loadedQueueRef.current = nextQueue;
      setMode('audio');
      setQueueState(nextQueue);
      setTrack(currentTrack);
      setIndex(targetIndex);
      setLastError(null);
      engine.updateLockScreenMetadata(currentTrack);
      if (positionMs > 0) {
        try {
          await engine.playlist.seekTo(positionMs / 1000);
        } catch {
        }
      }
      engine.playlist.play();
      return true;
    },
    [],
  );

  const appendAhead = useCallback((currentLocal: number) => {
    if (appendingRef.current) return;
    const resolveUri = resolveUriRef.current;
    const nextQueue = queueRef.current;
    const windowState = windowRef.current;
    if (!resolveUri || nextQueue.length === 0) return;
    const generation = loadGenerationRef.current;

    const range = nextAppendRange(
      windowState.globalIndexes,
      engine.playlist.trackCount,
      nextQueue.length,
      currentLocal,
      DEFAULT_WINDOW_RADIUS,
    );
    if (range.count <= 0) return;

    const indexes: number[] = [];
    for (let global = range.from; global <= range.to; global += 1) indexes.push(global);

    appendingRef.current = true;
    void Promise.all(
      indexes.map(async (global): Promise<ResolvedWindowTrack | null> => {
        const item = nextQueue[global];
        if (!item) return null;
        try {
          return { uri: await resolveUri(item), track: item, global };
        } catch {
          return null;
        }
      }),
    )
      .then((entries) => {
        const loaded = entries.filter((entry): entry is ResolvedWindowTrack => entry !== null);
        const fresh =
          generation === loadGenerationRef.current &&
          loadedQueueRef.current === nextQueue &&
          windowRef.current === windowState;
        if (fresh && loaded.length > 0) {
          engine.append(
            loaded.map(({ uri, track: item }) => ({ uri, track: item })),
            loaded.map((entry) => entry.global),
          );
          windowState.globalIndexes.push(...loaded.map((entry) => entry.global));
        }
      })
      .finally(() => {
        appendingRef.current = false;
      });
  }, []);

  const handleTrackChanged = useCallback(
    (event: { previousIndex: number; currentIndex: number }) => {
      if (modeRef.current !== 'audio') return;
      const nextQueue = queueRef.current;
      const windowState = windowRef.current;
      const trackCount = engine.playlist.trackCount;
      const resolveUri = resolveUriRef.current;

      const wrappedForward =
        repeatRef.current === 'all' &&
        trackCount > 1 &&
        event.previousIndex === trackCount - 1 &&
        event.currentIndex === 0;
      if (wrappedForward && resolveUri) {
        const previousGlobal = windowState.globalIndexes[event.previousIndex];
        const target = wrapTarget(previousGlobal, nextQueue.length, 'forward');
        if (target >= 0) {
          const local = windowState.globalIndexes.indexOf(target);
          if (local >= 0) engine.skipTo(local);
          else void loadWindow(target, nextQueue, resolveUri);
          return;
        }
      }

      const wrappedBackward =
        repeatRef.current === 'all' &&
        trackCount > 1 &&
        event.previousIndex === 0 &&
        event.currentIndex === trackCount - 1;
      if (wrappedBackward && resolveUri) {
        const previousGlobal = windowState.globalIndexes[event.previousIndex];
        const target = wrapTarget(previousGlobal, nextQueue.length, 'backward');
        if (target >= 0) {
          const local = windowState.globalIndexes.indexOf(target);
          if (local >= 0) engine.skipTo(local);
          else void loadWindow(target, nextQueue, resolveUri);
          return;
        }
      }

      const global = windowState.globalIndexes[event.currentIndex];
      const currentTrack = global === undefined ? undefined : nextQueue[global];
      if (!currentTrack) return;
      setIndex(global);
      setTrack(currentTrack);
      engine.updateLockScreenMetadata(currentTrack);
      appendAhead(event.currentIndex);
    },
    [appendAhead, loadWindow],
  );

  useEffect(() => {
    const subscription = engine.playlist.addListener('trackChanged', handleTrackChanged);
    return () => subscription.remove();
  }, [handleTrackChanged]);

  const playTrack = useCallback(
    async (
      nextTrack: Track,
      resolveUri: (track: Track) => Promise<string>,
      nextQueue: Track[] = [nextTrack],
    ): Promise<boolean> => {
      const requestId = ++requestRef.current;
      loadGenerationRef.current += 1;
      endHandledForRef.current = null;
      resolveUriRef.current = resolveUri;
      const targetIndex = nextQueue.findIndex((item) => item.id === nextTrack.id);

      if (nextTrack.source === 'demo') {
        engine.playlist.pause();
        setMode('mock');
        setMockPosition(0);
        setMockPlaying(true);
        setTrack(nextTrack);
        setQueueState(nextQueue);
        setIndex(targetIndex >= 0 ? targetIndex : 0);
        setLastError(null);
        return true;
      }

      const target = targetIndex >= 0 ? targetIndex : 0;
      try {
        const loaded = await loadWindow(target, nextQueue, resolveUri);
        if (requestId !== requestRef.current) return false;
        if (!loaded) setLastError('Could not play this file');
        return loaded;
      } catch {
        if (requestId !== requestRef.current) return false;
        setLastError('Could not play this file');
        return false;
      }
    },
    [loadWindow],
  );

  const seek = useCallback(
    async (positionMs: number): Promise<void> => {
      endHandledForRef.current = null;
      if (mode === 'mock') {
        setMockPosition(positionMs);
        setMockRunId((id) => id + 1);
        return;
      }
      await engine.playlist.seekTo(positionMs / 1000);
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
      void engine.playlist.seekTo(0);
      engine.playlist.play();
      return;
    }
    if (engine.playlist.playing) engine.playlist.pause();
    else engine.playlist.play();
  }, [mode, positionMs, durationMs]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    loadGenerationRef.current += 1;
    engine.stop();
    clearMockTimer();
    windowRef.current = { globalIndexes: [] };
    loadedQueueRef.current = null;
    appendingRef.current = false;
    setMode(null);
    setTrack(null);
    setQueueState([]);
    setIndex(-1);
    setMockPlaying(false);
    setMockPosition(0);
    setLastError(null);
  }, [clearMockTimer]);

  useEffect(() => {
    if (mode !== 'audio' || !track) return;
    if (loadedQueueRef.current === queue) return;
    if (queue.length === 0) return;
    const resolveUri = resolveUriRef.current;
    if (!resolveUri) return;
    const current = queue.findIndex((item) => item.id === track.id);
    const target = current >= 0 ? current : Math.min(Math.max(index, 0), queue.length - 1);
    const positionMs = Math.round(engine.playlist.currentTime * 1000);
    void loadWindow(target, queue, resolveUri, positionMs);
  }, [queue, mode, track, index, loadWindow]);

  const removeFromQueue = useCallback(
    (ids: string[]): void => {
      if (ids.length === 0) return;
      const removed = new Set(ids);
      if (!queue.some((item) => removed.has(item.id))) return;
      const filtered = queue.filter((item) => !removed.has(item.id));
      if (filtered.length === 0) {
        stop();
        return;
      }
      const current = queue[index];
      if (current && removed.has(current.id)) {
        stop();
        return;
      }
      setQueueState(filtered);
      setIndex(current ? filtered.findIndex((item) => item.id === current.id) : -1);
    },
    [queue, index, stop],
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

  const goToGlobal = useCallback(
    (target: number) => {
      const nextQueue = queueRef.current;
      const targetTrack = target >= 0 ? nextQueue[target] : undefined;
      const resolveUri = resolveUriRef.current;
      if (!targetTrack || !resolveUri) return;
      if (modeRef.current === 'audio') {
        const local = windowRef.current.globalIndexes.indexOf(target);
        if (local >= 0) {
          setIndex(target);
          setTrack(targetTrack);
          engine.skipTo(local);
          return;
        }
      }
      void loadWindow(target, nextQueue, resolveUri);
    },
    [loadWindow],
  );

  const navigate = useCallback(
    (target: number) => {
      if (target < 0) return;
      if (modeRef.current !== 'mock') {
        goToGlobal(target);
        return;
      }
      const nextQueue = queueRef.current;
      const targetTrack = nextQueue[target];
      const resolveUri = resolveUriRef.current;
      if (!targetTrack || !resolveUri) return;
      void playTrack(targetTrack, resolveUri, nextQueue);
    },
    [goToGlobal, playTrack],
  );

  const next = useCallback(() => {
    navigate(wrappedNext);
  }, [navigate, wrappedNext]);

  const previous = useCallback(() => {
    if (previousResult.type === 'restart') {
      void seek(0);
      return;
    }
    const target = previousResult.type === 'previous' ? previousResult.index : wrapPrevious ? queue.length - 1 : -1;
    navigate(target);
  }, [navigate, previousResult, wrapPrevious, queue.length, seek]);

  const skipNext = useCallback(() => {
    if (queue.length < 2) return;
    const current = index < 0 ? 0 : index;
    navigate((current + 1) % queue.length);
  }, [index, navigate, queue.length]);

  const skipPrevious = useCallback(() => {
    if (queue.length < 2) return;
    const current = index < 0 ? 0 : index;
    navigate((current - 1 + queue.length) % queue.length);
  }, [index, navigate, queue.length]);

  const hasNext = wrappedNext !== -1;
  const hasPrevious = previousResult.type !== 'none' || wrapPrevious;
  const queueLength = queue.length;

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
  }, []);

  const handleMockEnd = useCallback(() => {
    if (!track) return;
    if (endHandledForRef.current === track.id) return;
    endHandledForRef.current = track.id;
    if (repeat === 'one') {
      setMockPosition(0);
      setMockRunId((id) => id + 1);
      setMockPlaying(true);
      return;
    }
    const target = repeat === 'all' && index + 1 >= queue.length ? 0 : index + 1;
    const nextTrack = queue[target];
    if (nextTrack) {
      const resolveUri = resolveUriRef.current;
      if (resolveUri) void playTrack(nextTrack, resolveUri, queue);
      return;
    }
    setMockPlaying(false);
  }, [track, repeat, index, queue, playTrack]);

  useEffect(() => {
    if (mode !== 'mock' || !track || track.durationMs <= 0) return;
    if (mockPlaying || !isAtEnd(mockPosition, track.durationMs)) return;
    const timer = setTimeout(handleMockEnd, 0);
    return () => clearTimeout(timer);
  }, [mode, mockPlaying, mockPosition, track, handleMockEnd]);

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
