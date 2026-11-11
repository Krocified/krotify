import { AudioPlayer, createAudioPlayer, requestNotificationPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import type { Track } from '../types';

export const audioPlayer: AudioPlayer = createAudioPlayer(null, {
  updateInterval: 500,
  keepAudioSessionActive: true,
});

export async function configureAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
  if (Platform.OS === 'android') {
    try {
      await requestNotificationPermissionsAsync();
    } catch {
      // ponytail: playback still works; only the notification controls are hidden
    }
  }
}

export async function playAudio(uri: string, track: Track): Promise<void> {
  audioPlayer.replace({ uri });
  audioPlayer.setActiveForLockScreen(
    true,
    { title: track.title, artist: track.artist || undefined, albumTitle: track.album || undefined },
    { showNextTrack: false, showPreviousTrack: false, showSeekBackward: true, showSeekForward: true },
  );
  audioPlayer.play();
}

export function pauseAudio(): void {
  audioPlayer.pause();
}

export async function seekAudio(positionMs: number): Promise<void> {
  await audioPlayer.seekTo(positionMs / 1000);
}
