import { useAudioPlaylistStatus } from 'expo-audio';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { isMissingFileError } from '../library/playbackSource';
import { buildPlayableWindow, shouldProbeDuration } from '../lib/playbackRecovery';
import { mockTick } from '../lib/mockClock';
import { DEFAULT_WINDOW_RADIUS, nextAppendRange, playlistWindow, wrapTarget } from '../lib/playlistWindow';
import { isAtEnd, nextIndex, previousAction, upcomingQueue } from '../lib/queue';
import { restoreUpcoming, shuffleOrder, shuffleUpcoming } from '../lib/shuffle';
import { needsLockScreenReassert } from '../lib/lockScreen';
import { tickSleep, type SleepMode } from '../lib/sleepTimer';
import type { Track } from '../types';
import { setTrackMissing } from '../tracks/repo';
import { configureAudio, engine, type WindowTrack } from './audioEngine';

export type RepeatMode = 'off' | 'all' | 'one';


export type SleepState = { mode: SleepMode; remainingMs: number };

export type PlayerStatusValue = {
  track: Track | null;
  isPlaying: boolean;
  lastError: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  queueLength: number;
  upcoming: Track[];
  repeat: RepeatMode;
  shuffle: boolean;
  sleep: SleepState;
};

export type PlayerProgressValue = {
  positionMs: number;
  durationMs: number;
};

export type PlayerActionsValue = {
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setSleep: (mode: SleepMode, minutes?: number) => void;
  playTrack: (
    track: Track,
    resolveUri: (track: Track) => Promise<string>,
    queue?: Track[],
  ) => Promise<boolean>;
  restore: (
    track: Track,
    resolveUri: (track: Track) => Promise<string>,
    positionMs: number,
  ) => Promise<boolean>;
  advanceToNextPlayable: () => Promise<boolean>;
  toggle: () => void;
  seek: (positionMs: number) => Promise<void>;
  stop: () => void;
  next: () => void;
  previous: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  jumpTo: (trackId: string) => void;
  removeFromQueue: (ids: string[]) => void;
  setQueue: (queue: Track[]) => void;
};

export type PlayerContextValue = PlayerStatusValue & PlayerProgressValue & PlayerActionsValue;

type WindowState = {
  globalIndexes: number[];
};

type ResolvedWindowTrack = WindowTrack & { global: number };

const PlayerStatusContext = createContext<PlayerStatusValue | null>(null);
const PlayerProgressContext = createContext<PlayerProgressValue | null>(null);
const PlayerActionsContext = createContext<PlayerActionsValue | null>(null);

export function PlayerProvider({ children }: PropsWithChildren) {
  const [playlist, setPlaylist] = useState(() => engine.playlist);
  const status = useAudioPlaylistStatus(playlist);
  const [track, setTrack] = useState<Track | null>(null);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [mode, setMode] = useState<'audio' | 'mock' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mockPlaying, setMockPlaying] = useState(false);
  const [mockPosition, setMockPosition] = useState(0);
  const [mockRunId, setMockRunId] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const [sleep, setSleepState] = useState<SleepState>({ mode: 'off', remainingMs: 0 });
  const requestRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveUriRef = useRef<((track: Track) => Promise<string>) | null>(null);
  const endHandledForRef = useRef<string | null>(null);
  const queueRef = useRef<Track[]>([]);
  const modeRef = useRef<'audio' | 'mock' | null>(null);
  const repeatRef = useRef<RepeatMode>('off');
  const shuffleRef = useRef(false);
  const originalQueueRef = useRef<Track[]>([]);
  const sleepRef = useRef<SleepState>({ mode: 'off', remainingMs: 0 });
  const sleepRemainingRef = useRef(0);
  const reassertedTrackRef = useRef<string | null>(null);
  const sleepEndTrackRef = useRef<string | null>(null);
  const trackRef = useRef<Track | null>(null);
  const windowRef = useRef<WindowState>({ globalIndexes: [] });
  const loadedQueueRef = useRef<Track[] | null>(null);
  const appendingRef = useRef(false);
  const indexRef = useRef(-1);
  const wantPlayingRef = useRef(false);
  const positionRef = useRef(0);
  const durationRef = useRef(0);

  useEffect(() => {
    const current = trackRef.current;
    if (!current || modeRef.current !== 'audio') return;
    const durationMs = Math.round((status.duration ?? 0) * 1000);
    if (
      !needsLockScreenReassert({
        isActive: true,
        isLoaded: Boolean(status.isLoaded),
        durationMs,
        trackId: current.id,
        reassertedTrackId: reassertedTrackRef.current,
      })
    ) {
      return;
    }
    reassertedTrackRef.current = current.id;
    engine.updateLockScreenMetadata(current);
  }, [status.duration, status.isLoaded, status.currentIndex]);

  const resetAudioWindow = useCallback(() => {
    loadGenerationRef.current += 1;
    wantPlayingRef.current = false;
    reassertedTrackRef.current = null;
    engine.recreate();
    setPlaylist(engine.playlist);
    engine.setLoop(repeatRef.current === 'off' ? 'none' : repeatRef.current === 'one' ? 'single' : 'all');
    if (trackRef.current) engine.updateLockScreenMetadata(trackRef.current);
    windowRef.current = { globalIndexes: [] };
    loadedQueueRef.current = null;
    appendingRef.current = false;
  }, []);

  const skipToLocal = useCallback(
    (local: number) => {
      try {
        engine.skipTo(local);
      } catch {
        setLastError('Could not play this file');
        resetAudioWindow();
      }
    },
    [resetAudioWindow],
  );

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
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    sleepRef.current = sleep;
  }, [sleep]);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);


  useEffect(() => {
    engine.setLoop(repeat === 'off' ? 'none' : repeat === 'one' ? 'single' : 'all');
  }, [repeat]);

  useEffect(() => {
    configureAudio().catch(() => setLastError('Could not start audio session'));
    return clearMockTimer;
  }, [clearMockTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      engine.resync();
      configureAudio().catch(() => {});
      const current = trackRef.current;
      if (current && modeRef.current === 'audio') engine.updateLockScreenMetadata(current);
    });
    return () => subscription.remove();
  }, []);

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

  const finishSleep = useCallback(() => {
    sleepRemainingRef.current = 0;
    sleepRef.current = { mode: 'off', remainingMs: 0 };
    setSleepState({ mode: 'off', remainingMs: 0 });
    engine.setVolume(1);
    wantPlayingRef.current = false;
    if (modeRef.current === 'mock') setMockPlaying(false);
    else engine.playlist.pause();
  }, []);

  const setSleep = useCallback((nextMode: SleepMode, minutes = 0) => {
    if (nextMode === 'timer') {
      const ms = Math.max(0, Math.round(minutes * 60_000));
      if (ms <= 0) {
        sleepRemainingRef.current = 0;
        sleepRef.current = { mode: 'off', remainingMs: 0 };
        setSleepState({ mode: 'off', remainingMs: 0 });
        engine.setVolume(1);
        return;
      }
      sleepRemainingRef.current = ms;
      sleepRef.current = { mode: 'timer', remainingMs: ms };
      setSleepState({ mode: 'timer', remainingMs: ms });
      engine.setVolume(1);
      return;
    }
    sleepRemainingRef.current = 0;
    sleepEndTrackRef.current = nextMode === 'end' ? (trackRef.current?.id ?? null) : null;
    sleepRef.current = { mode: nextMode, remainingMs: 0 };
    setSleepState({ mode: nextMode, remainingMs: 0 });
    engine.setVolume(1);
  }, []);

  useEffect(() => {
    if (sleep.mode !== 'timer') return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      const tick = tickSleep(sleepRemainingRef.current, elapsed);
      sleepRemainingRef.current = tick.remainingMs;
      if (tick.done) {
        finishSleep();
        return;
      }
      setSleepState((current) =>
        current.mode === 'timer' ? { ...current, remainingMs: tick.remainingMs } : current,
      );
      engine.setVolume(tick.fadeFrom ?? 1);
    }, 250);
    return () => {
      clearInterval(timer);
      engine.setVolume(1);
    };
  }, [sleep.mode, finishSleep]);

  const loadWindow = useCallback(
    async (
      targetIndex: number,
      nextQueue: Track[],
      resolveUri: (track: Track) => Promise<string>,
      positionMs = 0,
      play = true,
    ): Promise<boolean> => {
      if (nextQueue.length === 0) return false;
      const generation = ++loadGenerationRef.current;
      const { start, end } = playlistWindow(targetIndex, nextQueue.length, DEFAULT_WINDOW_RADIUS);
      const indexes: number[] = [];
      for (let global = start; global <= end; global += 1) indexes.push(global);
      const resolved = await Promise.all(
        indexes.map(async (global) => {
          const item = nextQueue[global];
          if (!item) return { global, uri: null, missing: false } as const;
          try {
            return { global, uri: await resolveUri(item), missing: false } as const;
          } catch (error) {
            return { global, uri: null, missing: isMissingFileError(error) } as const;
          }
        }),
      );
      if (generation !== loadGenerationRef.current) return false;

      const resolvedWindow = buildPlayableWindow(
        resolved.map(({ global, uri }) => ({ global, uri })),
        targetIndex,
      );
      for (const entry of resolved) {
        const item = nextQueue[entry.global];
        if (entry.missing && item) void setTrackMissing(item.id, true).catch(() => {});
      }

      const currentTrack = nextQueue[targetIndex];
      if (!currentTrack) {
        setLastError('Could not play this file');
        resetAudioWindow();
        return false;
      }
      if (resolvedWindow.localIndex < 0) {
        setLastError('File missing');
        setTrack({ ...currentTrack, missing: 1 });
        setQueueState(nextQueue);
        setIndex(targetIndex);
        setMode('audio');
        resetAudioWindow();
        return false;
      }

      if (shouldProbeDuration(currentTrack.durationMs, currentTrack.source)) {
        const targetEntry = resolved.find((entry) => entry.global === targetIndex);
        if (targetEntry?.uri) {
          const { probeDurationMs } = await import('../imports/probe');
          const probedMs = await probeDurationMs(targetEntry.uri).catch(() => 0);
          if (generation !== loadGenerationRef.current) return false;
          if (probedMs <= 0) {
            void setTrackMissing(currentTrack.id, true).catch(() => {});
            setLastError(currentTrack.missing ? 'File missing' : 'Unplayable file');
            setTrack({ ...currentTrack, missing: 1 });
            setQueueState(nextQueue);
            setIndex(targetIndex);
            setMode('audio');
            resetAudioWindow();
            return false;
          }
        }
      }

      wantPlayingRef.current = play;
      const loaded = resolvedWindow.playable;
      try {
        engine.setVolume(1);
        engine.load(
          loaded.map(({ global, uri }) => ({ uri, track: nextQueue[global] })),
          resolvedWindow.localIndex,
          loaded.map((entry) => entry.global),
          play,
        );
      } catch {
        setLastError('Could not play this file');
        resetAudioWindow();
        return false;
      }
      windowRef.current = { globalIndexes: loaded.map((entry) => entry.global) };
      loadedQueueRef.current = nextQueue;
      setMode('audio');
      setQueueState(nextQueue);
      if (currentTrack.missing) void setTrackMissing(currentTrack.id, false).catch(() => {});
      setTrack(currentTrack.missing ? { ...currentTrack, missing: 0 } : currentTrack);
      setIndex(targetIndex);
      setLastError(null);
      engine.updateLockScreenMetadata(currentTrack);
      if (positionMs > 0) {
        try {
          await engine.playlist.seekTo(positionMs / 1000);
        } catch {
          setLastError('Could not seek');
        }
      }
      return true;
    },
    [resetAudioWindow],
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
          try {
            engine.append(
              loaded.map(({ uri, track: item }) => ({ uri, track: item })),
              loaded.map((entry) => entry.global),
            );
            windowState.globalIndexes.push(...loaded.map((entry) => entry.global));
          } catch {
            setLastError('Could not play this file');
            resetAudioWindow();
          }
        }
      })
      .finally(() => {
        appendingRef.current = false;
      });
  }, [resetAudioWindow]);

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
        if (shuffleRef.current) {
          const result = shuffleOrder(nextQueue, -1, Math.random);
          void loadWindow(0, result.order, resolveUri);
          return;
        }
        const previousGlobal = windowState.globalIndexes[event.previousIndex];
        const target = wrapTarget(previousGlobal, nextQueue.length, 'forward');
        if (target >= 0) {
          const local = windowState.globalIndexes.indexOf(target);
          if (local >= 0) skipToLocal(local);
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
          if (local >= 0) skipToLocal(local);
          else void loadWindow(target, nextQueue, resolveUri);
          return;
        }
      }

      const global = windowState.globalIndexes[event.currentIndex];
      const currentTrack = global === undefined ? undefined : nextQueue[global];
      if (!currentTrack) return;
      wantPlayingRef.current = engine.playlist.playing;
      setIndex(global);
      setTrack(currentTrack);
      engine.updateLockScreenMetadata(currentTrack);
      engine.setVolume(1);
      appendAhead(event.currentIndex);
    },
    [appendAhead, loadWindow, skipToLocal],
  );

  useEffect(() => {
    const subscription = playlist.addListener('trackChanged', handleTrackChanged);
    return () => subscription.remove();
  }, [playlist, handleTrackChanged]);


  const playTrack = useCallback(
    async (
      nextTrack: Track,
      resolveUri: (track: Track) => Promise<string>,
      nextQueue: Track[] = [nextTrack],
    ): Promise<boolean> => {
      const requestId = ++requestRef.current;
      loadGenerationRef.current += 1;
      endHandledForRef.current = null;
      reassertedTrackRef.current = null;
      resolveUriRef.current = resolveUri;
      const targetIndex = nextQueue.findIndex((item) => item.id === nextTrack.id);
      let playQueue = nextQueue;
      let target = targetIndex >= 0 ? targetIndex : 0;

      if (shuffleRef.current && nextQueue !== queueRef.current) {
        originalQueueRef.current = nextQueue;
        const result = shuffleOrder(nextQueue, target, Math.random);
        playQueue = result.order;
        target = result.index;
      }

      if (nextTrack.source === 'demo') {
        engine.playlist.pause();
        engine.setVolume(1);
        setMode('mock');
        setMockPosition(0);
        setMockPlaying(true);
        setTrack(nextTrack);
        setQueueState(playQueue);
        setIndex(target);
        setLastError(null);
        return true;
      }

      try {
        const loaded = await loadWindow(target, playQueue, resolveUri);
        if (requestId !== requestRef.current) return false;
        return loaded;
      } catch {
        if (requestId !== requestRef.current) return false;
        setLastError('Could not play this file');
        resetAudioWindow();
        return false;
      }
    },
    [loadWindow, resetAudioWindow],
  );

  const restore = useCallback(
    async (
      nextTrack: Track,
      resolveUri: (track: Track) => Promise<string>,
      positionMs: number,
    ): Promise<boolean> => {
      const requestId = ++requestRef.current;
      loadGenerationRef.current += 1;
      endHandledForRef.current = null;
      resolveUriRef.current = resolveUri;

      if (nextTrack.source === 'demo') {
        engine.playlist.pause();
        engine.setVolume(1);
        setMode('mock');
        setMockPosition(Math.min(Math.max(0, positionMs), nextTrack.durationMs));
        setMockPlaying(false);
        setTrack(nextTrack);
        setQueueState([nextTrack]);
        setIndex(0);
        setLastError(null);
        return true;
      }

      try {
        const loaded = await loadWindow(0, [nextTrack], resolveUri, positionMs, false);
        if (requestId !== requestRef.current) return false;
        return loaded;
      } catch {
        if (requestId !== requestRef.current) return false;
        setLastError('Could not play this file');
        resetAudioWindow();
        return false;
      }
    },
    [loadWindow, resetAudioWindow],
  );

  const advanceToNextPlayable = useCallback(async (): Promise<boolean> => {
    const resolveUri = resolveUriRef.current;
    const nextQueue = queueRef.current;
    if (!resolveUri || nextQueue.length === 0) {
      setLastError('No playable tracks');
      return false;
    }
    const start = indexRef.current;
    for (let offset = 1; offset <= nextQueue.length; offset += 1) {
      const candidate = start < 0 ? offset - 1 : (start + offset) % nextQueue.length;
      const item = nextQueue[candidate];
      if (!item) continue;
      try {
        await resolveUri(item);
      } catch (error) {
        if (isMissingFileError(error)) void setTrackMissing(item.id, true).catch(() => {});
        continue;
      }
      return loadWindow(candidate, nextQueue, resolveUri);
    }
    setLastError('No playable tracks');
    return false;
  }, [loadWindow]);

  const seek = useCallback(
    async (positionMs: number): Promise<void> => {
      endHandledForRef.current = null;
      if (mode === 'mock') {
        setMockPosition(positionMs);
        setMockRunId((id) => id + 1);
        return;
      }
      try {
        await engine.playlist.seekTo(positionMs / 1000);
      } catch {
        setLastError('Could not seek');
      }
    },
    [mode],
  );

  const isPlaying = mode === 'mock' ? mockPlaying : status.playing;
  const positionMs = mode === 'mock' ? mockPosition : Math.round(status.currentTime * 1000);
  const durationMs =
    mode === 'mock'
      ? (track?.durationMs ?? 0)
      : Math.round((status.duration || (track?.durationMs ?? 0) / 1000) * 1000);

  useEffect(() => {
    positionRef.current = positionMs;
    durationRef.current = durationMs;
  }, [durationMs, positionMs]);

  useEffect(() => {
    if (sleep.mode !== 'end' || mode !== 'audio' || !status.didJustFinish) return;
    const timer = setTimeout(finishSleep, 0);
    return () => clearTimeout(timer);
  }, [sleep.mode, mode, status.didJustFinish, finishSleep]);


  const retryIfStalled = useCallback(
    (startPositionMs: number) => {
      const generation = loadGenerationRef.current;
      setTimeout(() => {
        if (!wantPlayingRef.current || loadGenerationRef.current !== generation) return;
        try {
          if (engine.playlist.playing || engine.playlist.isBuffering) return;
        } catch {
          return;
        }
        const resolveUri = resolveUriRef.current;
        const nextQueue = queueRef.current;
        if (!resolveUri || nextQueue.length === 0) return;
        const target = indexRef.current >= 0 ? indexRef.current : 0;
        void loadWindow(target, nextQueue, resolveUri, Math.max(0, startPositionMs), true);
      }, 550);
    },
    [loadWindow],
  );

  const toggle = useCallback(() => {
    const atEnd = isAtEnd(positionRef.current, durationRef.current);
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
      void engine.playlist.seekTo(0).catch(() => setLastError('Could not seek'));
      try {
        wantPlayingRef.current = true;
        engine.playlist.play();
        retryIfStalled(0);
      } catch {
        setLastError('Could not play this file');
        resetAudioWindow();
      }
      return;
    }
    try {
      if (engine.playlist.playing) {
        wantPlayingRef.current = false;
        engine.playlist.pause();
      } else {
        wantPlayingRef.current = true;
        let startPositionMs = positionRef.current;
        try {
          startPositionMs = Math.round(engine.playlist.currentTime * 1000);
        } catch {}
        engine.playlist.play();
        retryIfStalled(startPositionMs);
      }
    } catch {
      setLastError('Could not play this file');
      resetAudioWindow();
    }
  }, [mode, resetAudioWindow, retryIfStalled]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    loadGenerationRef.current += 1;
    wantPlayingRef.current = false;
    engine.stop();
    clearMockTimer();
    setSleep('off');
    shuffleRef.current = false;
    originalQueueRef.current = [];
    setShuffle(false);
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
  }, [clearMockTimer, setSleep]);

  useEffect(() => {
    if (mode !== 'audio' || !track) return;
    if (track.missing === 1) return;
    if (loadedQueueRef.current === queue) return;
    if (queue.length === 0) return;
    const resolveUri = resolveUriRef.current;
    if (!resolveUri) return;
    const current = queue.findIndex((item) => item.id === track.id);
    const target = current >= 0 ? current : Math.min(Math.max(index, 0), queue.length - 1);
    const positionMs = Math.round(engine.playlist.currentTime * 1000);
    const wasPlaying = engine.playlist.playing;
    void loadWindow(target, queue, resolveUri, positionMs, wasPlaying);
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
      if (shuffleRef.current && originalQueueRef.current.length > 0) {
        const nextOriginal = originalQueueRef.current.filter((item) => !removed.has(item.id));
        originalQueueRef.current = nextOriginal;
        if (nextOriginal.length === 0) {
          shuffleRef.current = false;
          setShuffle(false);
        }
      }
      setQueueState(filtered);
      setIndex(current ? filtered.findIndex((item) => item.id === current.id) : -1);
    },
    [queue, index, stop],
  );

  const setQueue = useCallback(
    (nextQueue: Track[]): void => {
      if (shuffleRef.current && track) {
        originalQueueRef.current = nextQueue;
        const current = nextQueue.findIndex((item) => item.id === track.id);
        const result = shuffleOrder(nextQueue, current, Math.random);
        setQueueState(result.order);
        setIndex(result.index);
        return;
      }
      setQueueState(nextQueue);
      setIndex(track ? nextQueue.findIndex((item) => item.id === track.id) : -1);
    },
    [track],
  );

  const applyQueueOrder = useCallback(
    async (nextOrder: Track[], nextIndexValue: number): Promise<void> => {
      const currentTrack = nextIndexValue >= 0 ? nextOrder[nextIndexValue] : undefined;
      if (!currentTrack) return;

      const commit = () => {
        queueRef.current = nextOrder;
        indexRef.current = nextIndexValue;
        loadedQueueRef.current = nextOrder;
        setQueueState(nextOrder);
        setIndex(nextIndexValue);
      };

      const resolveUri = resolveUriRef.current;
      if (modeRef.current !== 'audio' || !resolveUri) {
        commit();
        return;
      }

      const localIndex = engine.playlist.currentIndex;
      const windowState = windowRef.current;
      if (localIndex < 0 || windowState.globalIndexes[localIndex] !== nextIndexValue) {
        commit();
        return;
      }

      const ahead = Math.min(
        DEFAULT_WINDOW_RADIUS,
        Math.max(0, nextOrder.length - nextIndexValue - 1),
      );
      const upcoming = nextOrder.slice(nextIndexValue + 1, nextIndexValue + 1 + ahead);
      const resolved = await Promise.all(
        upcoming.map(async (item, offset) => {
          try {
            return { uri: await resolveUri(item), track: item, offset } as const;
          } catch {
            return null;
          }
        }),
      );
      const loaded = resolved.filter(
        (entry): entry is { uri: string; track: Track; offset: number } =>
          entry !== null,
      );
      const indexes = loaded.map((entry) => nextIndexValue + 1 + entry.offset);
      if (!engine.replaceUpcoming(loaded, indexes)) {
        const position = Math.round(engine.playlist.currentTime * 1000);
        const wasPlaying = engine.playlist.playing;
        void loadWindow(nextIndexValue, nextOrder, resolveUri, position, wasPlaying);
        return;
      }
      windowState.globalIndexes = [
        ...windowState.globalIndexes.slice(0, localIndex + 1),
        ...indexes,
      ];
      commit();
    },
    [loadWindow],
  );

  const toggleShuffle = useCallback((): void => {
    const currentQueue = queueRef.current.length > 0 ? queueRef.current : queue;
    const currentTrack = trackRef.current ?? track;
    if (!currentTrack) return;
    const localIndex = modeRef.current === 'audio' ? engine.playlist.currentIndex : -1;
    const engineGlobal =
      localIndex >= 0 ? windowRef.current.globalIndexes[localIndex] : undefined;
    const currentIndex =
      engineGlobal !== undefined && engineGlobal >= 0 && engineGlobal < currentQueue.length
        ? engineGlobal
        : indexRef.current >= 0
          ? indexRef.current
          : currentQueue.findIndex((item) => item.id === currentTrack.id);
    if (currentIndex < 0) return;

    if (shuffleRef.current) {
      shuffleRef.current = false;
      setShuffle(false);
      const original =
        originalQueueRef.current.length > 0 ? originalQueueRef.current : currentQueue;
      originalQueueRef.current = [];
      const result = restoreUpcoming(currentQueue, original, currentIndex);
      void applyQueueOrder(result.order, result.index);
      return;
    }

    if (currentQueue.length < 2) return;
    originalQueueRef.current = currentQueue;
    const result = shuffleUpcoming(currentQueue, currentIndex, Math.random);
    shuffleRef.current = true;
    setShuffle(true);
    void applyQueueOrder(result.order, result.index);
  }, [applyQueueOrder, queue, track]);

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
          skipToLocal(local);
          setIndex(target);
          setTrack(targetTrack);
          return;
        }
      }
      void loadWindow(target, nextQueue, resolveUri);
    },
    [loadWindow, skipToLocal],
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

  const jumpTo = useCallback(
    (trackId: string) => {
      const target = queueRef.current.findIndex((item) => item.id === trackId);
      if (target >= 0) navigate(target);
    },
    [navigate],
  );

  const next = useCallback(() => {
    const length = queueRef.current.length;
    const current = indexRef.current;
    const target = nextIndex(current, length);
    const wrapped =
      repeatRef.current === 'all' && length > 1 && current === length - 1 ? 0 : target;
    navigate(wrapped);
  }, [navigate]);

  const previous = useCallback(() => {
    const length = queueRef.current.length;
    const current = indexRef.current;
    const result = previousAction(positionRef.current, current, length);
    if (result.type === 'restart') {
      void seek(0);
      return;
    }
    const canWrap = repeatRef.current === 'all' && length > 1;
    const wrapped = canWrap && current === 0 && result.type === 'none';
    const target = result.type === 'previous' ? result.index : wrapped ? length - 1 : -1;
    navigate(target);
  }, [navigate, seek]);

  const skipNext = useCallback(() => {
    const length = queueRef.current.length;
    if (length < 2) return;
    const current = indexRef.current < 0 ? 0 : indexRef.current;
    navigate((current + 1) % length);
  }, [navigate]);

  const skipPrevious = useCallback(() => {
    const length = queueRef.current.length;
    if (length < 2) return;
    const current = indexRef.current < 0 ? 0 : indexRef.current;
    navigate((current - 1 + length) % length);
  }, [navigate]);

  const hasNext = wrappedNext !== -1;
  const hasPrevious = previousResult.type !== 'none' || wrapPrevious;
  const queueLength = queue.length;
  const upcoming = useMemo(() => upcomingQueue(queue, index), [queue, index]);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
  }, []);

  const handleMockEnd = useCallback(() => {
    if (!track) return;
    if (endHandledForRef.current === track.id) return;
    endHandledForRef.current = track.id;
    if (sleepRef.current.mode === 'end') {
      finishSleep();
      return;
    }
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
  }, [track, repeat, index, queue, playTrack, finishSleep]);

  useEffect(() => {
    if (mode !== 'mock' || !track || track.durationMs <= 0) return;
    if (mockPlaying || !isAtEnd(mockPosition, track.durationMs)) return;
    const timer = setTimeout(handleMockEnd, 0);
    return () => clearTimeout(timer);
  }, [mode, mockPlaying, mockPosition, track, handleMockEnd]);

  const statusValue = useMemo<PlayerStatusValue>(
    () => ({
      track,
      isPlaying,
      lastError,
      hasNext,
      hasPrevious,
      queueLength,
      upcoming,
      repeat,
      shuffle,
      sleep,
    }),
    [
      hasNext,
      hasPrevious,
      isPlaying,
      lastError,
      queueLength,
      repeat,
      shuffle,
      sleep,
      track,
      upcoming,
    ],
  );

  const progressValue = useMemo<PlayerProgressValue>(
    () => ({ positionMs, durationMs }),
    [durationMs, positionMs],
  );

  const actionsValue = useMemo<PlayerActionsValue>(
    () => ({
      cycleRepeat,
      toggleShuffle,
      setSleep,
      playTrack,
      restore,
      advanceToNextPlayable,
      toggle,
      seek,
      stop,
      next,
      previous,
      skipNext,
      skipPrevious,
      jumpTo,
      removeFromQueue,
      setQueue,
    }),
    [
      advanceToNextPlayable,
      cycleRepeat,
      jumpTo,
      next,
      playTrack,
      previous,
      removeFromQueue,
      restore,
      seek,
      setQueue,
      setSleep,
      skipNext,
      skipPrevious,
      stop,
      toggle,
      toggleShuffle,
    ],
  );

  return (
    <PlayerActionsContext.Provider value={actionsValue}>
      <PlayerStatusContext.Provider value={statusValue}>
        <PlayerProgressContext.Provider value={progressValue}>
          {children}
        </PlayerProgressContext.Provider>
      </PlayerStatusContext.Provider>
    </PlayerActionsContext.Provider>
  );

}

export function usePlayerStatus(): PlayerStatusValue {
  const context = useContext(PlayerStatusContext);
  if (!context) throw new Error('usePlayerStatus must be used within a PlayerProvider');
  return context;
}

export function usePlayerProgress(): PlayerProgressValue {
  const context = useContext(PlayerProgressContext);
  if (!context) throw new Error('usePlayerProgress must be used within a PlayerProvider');
  return context;
}

export function usePlayerActions(): PlayerActionsValue {
  const context = useContext(PlayerActionsContext);
  if (!context) throw new Error('usePlayerActions must be used within a PlayerProvider');
  return context;
}

export function usePlayer(): PlayerContextValue {
  const status = usePlayerStatus();
  const progress = usePlayerProgress();
  const actions = usePlayerActions();
  return useMemo(() => ({ ...status, ...progress, ...actions }), [actions, progress, status]);
}
