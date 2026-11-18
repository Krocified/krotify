import {
  type AudioLockScreenOptions,
  type AudioMetadata,
  type AudioPlaylist,
  createAudioPlaylist,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';
import type { Track } from '../types';

export type WindowTrack = { uri: string; track: Track };

export type EngineLoopMode = 'none' | 'single' | 'all';

export type PlaybackEngine = {
  readonly playlist: AudioPlaylist;
  recreate(): void;
  load(tracks: WindowTrack[], localIndex: number, globalIndexes?: number[], autoplay?: boolean): void;
  append(tracks: WindowTrack[], globalIndexes: number[]): void;
  skipTo(local: number): void;
  setVolume(value: number): void;
  setLoop(mode: EngineLoopMode): void;
  updateLockScreenMetadata(track: Track): void;
  stop(): void;
};

export async function configureAudio(): Promise<void> {
  if (Platform.OS === 'web') return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
}

const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showNextTrack: true,
  showPreviousTrack: true,
  showSeekBackward: true,
  showSeekForward: true,
};

export function lockScreenMetadata(track: Track): AudioMetadata {
  return {
    title: track.title,
    artist: track.artist || undefined,
    albumTitle: track.album || undefined,
    artworkUrl: track.artworkUri || undefined,
  };
}

let notificationPermissionRequested = false;

function requestNotificationPermission(): void {
  if (notificationPermissionRequested || Platform.OS !== 'android') return;
  notificationPermissionRequested = true;
  requestNotificationPermissionsAsync().catch(() => {});
}

export function createEngine(): PlaybackEngine {
  let playlist = createAudioPlaylist({ updateInterval: 200 });
  const globalIndexes: number[] = [];
  let loopMode: EngineLoopMode = 'none';
  let volume = 1;
  const lockScreen: { current: { metadata: AudioMetadata; options: AudioLockScreenOptions } | null } = {
    current: null,
  };

  return {
    get playlist() {
      return playlist;
    },

    recreate() {
      const previous = playlist;
      try {
        previous.pause();
      } catch {}
      try {
        previous.clearLockScreenControls();
      } catch {}
      try {
        previous.clear();
      } catch {}
      if (typeof previous.destroy === 'function') {
        try {
          previous.destroy();
        } catch {}
      }
      playlist = createAudioPlaylist({ updateInterval: 200 });
      playlist.loop = loopMode;
      playlist.volume = volume;
      globalIndexes.length = 0;
    },

    load(tracks, localIndex, indexes, autoplay = true) {
      playlist.clear();
      globalIndexes.length = 0;
      for (const item of tracks) playlist.add({ uri: item.uri });
      globalIndexes.push(...(indexes ?? tracks.map((_, index) => index)));
      const current = tracks[localIndex];
      if (!current) return;
      requestNotificationPermission();
      playlist.skipTo(localIndex);
      const metadata = lockScreenMetadata(current.track);
      lockScreen.current = { metadata, options: LOCK_SCREEN_OPTIONS };
      playlist.setActiveForLockScreen(true, metadata, LOCK_SCREEN_OPTIONS);
      if (autoplay) playlist.play();
      else playlist.pause();
    },

    append(tracks, indexes) {
      for (const item of tracks) playlist.add({ uri: item.uri });
      globalIndexes.push(...indexes);
    },

    skipTo(local) {
      playlist.skipTo(local);
    },

    setVolume(value) {
      volume = value;
      playlist.volume = value;
    },

    setLoop(mode) {
      loopMode = mode;
      playlist.loop = mode;
    },

    updateLockScreenMetadata(track) {
      const metadata = lockScreenMetadata(track);
      lockScreen.current = { metadata, options: LOCK_SCREEN_OPTIONS };
      playlist.updateLockScreenMetadata(metadata);
    },

    stop() {
      try {
        playlist.pause();
      } catch {}
      try {
        playlist.clearLockScreenControls();
      } catch {}
      try {
        playlist.clear();
      } catch {}
      lockScreen.current = null;
      globalIndexes.length = 0;
    },
  };
}

export const engine = createEngine();
