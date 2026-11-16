import { createAudioPlayer } from 'expo-audio';

const PROBE_TIMEOUT_MS = 2000;

export function probeDurationMs(uri: string): Promise<number> {
  return new Promise((resolve) => {
    const player = createAudioPlayer(uri, { updateInterval: 100 });
    let subscription: { remove(): void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const finish = (ms: number) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        subscription?.remove();
      } catch {}
      try {
        player.remove();
      } catch {}
      resolve(ms);
    };

    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) finish(Math.round((status.duration ?? 0) * 1000));
    });
    timer = setTimeout(() => finish(0), PROBE_TIMEOUT_MS);
  });
}
