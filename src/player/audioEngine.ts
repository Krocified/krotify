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
  playlist: AudioPlaylist;
  load(tracks: WindowTrack[], localIndex: number, globalIndexes?: number[]): void;
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
  const playlist = createAudioPlaylist({ updateInterval: 500 });
  const globalIndexes: number[] = [];

  return {
    playlist,

    load(tracks, localIndex, indexes) {
      playlist.clear();
      globalIndexes.length = 0;
      for (const item of tracks) playlist.add({ uri: item.uri });
      globalIndexes.push(...(indexes ?? tracks.map((_, index) => index)));
      const current = tracks[localIndex];
      if (!current) return;
      requestNotificationPermission();
      playlist.skipTo(localIndex);
      playlist.setActiveForLockScreen(
        true,
        lockScreenMetadata(current.track),
        LOCK_SCREEN_OPTIONS,
      );
      playlist.play();
    },

    append(tracks, indexes) {
      for (const item of tracks) playlist.add({ uri: item.uri });
      globalIndexes.push(...indexes);
    },

    skipTo(local) {
      playlist.skipTo(local);
    },

    setVolume(value) {
      playlist.volume = value;
    },

    setLoop(mode) {
      playlist.loop = mode;
    },

    updateLockScreenMetadata(track) {
      playlist.updateLockScreenMetadata(lockScreenMetadata(track));
    },

    stop() {
      playlist.pause();
      playlist.clearLockScreenControls();
      playlist.clear();
      globalIndexes.length = 0;
    },
  };
}

export const engine = createEngine();
