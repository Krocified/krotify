import type { CachedMetadata } from './repo';

export function mergeCachedMetadata(
  existing: CachedMetadata | null,
  patch: CachedMetadata,
): CachedMetadata {
  const artworkUri = patch.artworkUri ?? existing?.artworkUri;
  return {
    ...existing,
    ...patch,
    ...(artworkUri === undefined ? {} : { artworkUri }),
  };
}
