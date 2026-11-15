import type { Track } from '../types';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 2;

type HydrateOptions = {
  concurrency?: number;
  batchSize?: number;
  isCancelled?: () => boolean;
};

const inFlight = new Set<string>();

export async function hydrateArtwork(
  tracks: Track[],
  onBatch: (updated: Track[]) => void,
  options: HydrateOptions = {},
): Promise<void> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
  const isCancelled = options.isCancelled ?? (() => false);
  const eligible = tracks.filter(
    (track) => track.uri && !track.artworkUri && track.source !== 'demo' && !inFlight.has(track.id),
  );
  if (eligible.length === 0) return;
  for (const track of eligible) inFlight.add(track.id);

  try {
    const { loadArtwork } = await import('./metadata');
    for (let start = 0; start < eligible.length; start += batchSize) {
      if (isCancelled()) return;
      const batch = eligible.slice(start, start + batchSize);
      const updated: Track[] = [];
      for (let index = 0; index < batch.length; index += concurrency) {
        if (isCancelled()) return;
        const group = batch.slice(index, index + concurrency);
        const uris = await Promise.all(
          group.map((track) => loadArtwork(track).catch(() => null)),
        );
        group.forEach((track, offset) => {
          const uri = uris[offset];
          if (uri) updated.push({ ...track, artworkUri: uri });
        });
      }
      if (isCancelled()) return;
      if (updated.length > 0) onBatch(updated);
    }
  } finally {
    for (const track of eligible) inFlight.delete(track.id);
  }
}
