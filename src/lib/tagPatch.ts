export type TagFields = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  explicit?: boolean;
};

export type ArtworkInput = {
  mimeType: string;
  sizeBytes: number;
};

export type TagPatchValidation =
  | { ok: true; value: TagFields }
  | { ok: false; errors: string[] };

export const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

const STRING_FIELDS = ['title', 'artist', 'album', 'albumArtist', 'genre'] as const;
const INTEGER_FIELDS = ['trackNumber', 'discNumber', 'year'] as const;

function validateArtwork(artwork: ArtworkInput, errors: string[]): void {
  if (typeof artwork.mimeType !== 'string' || !artwork.mimeType.toLowerCase().startsWith('image/')) {
    errors.push('Artwork must be an image.');
  }
  if (
    typeof artwork.sizeBytes !== 'number' ||
    !Number.isInteger(artwork.sizeBytes) ||
    artwork.sizeBytes <= 0
  ) {
    errors.push('Artwork size is invalid.');
  } else if (artwork.sizeBytes > MAX_ARTWORK_BYTES) {
    errors.push(`Artwork must be ${MAX_ARTWORK_BYTES} bytes or smaller.`);
  }
}

export function validateTagPatch(
  patch: Partial<TagFields>,
  artwork?: ArtworkInput,
): TagPatchValidation {
  const errors: string[] = [];
  const value: TagFields = {};
  const source = patch as Record<string, unknown>;

  for (const key of STRING_FIELDS) {
    const raw = source[key];
    if (raw === undefined) continue;
    if (typeof raw !== 'string') {
      errors.push(`${key} must be a string.`);
      continue;
    }
    value[key] = raw.trim();
  }

  for (const key of INTEGER_FIELDS) {
    const raw = source[key];
    if (raw === undefined) continue;
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      errors.push(`${key} must be an integer.`);
      continue;
    }
    if (key === 'year' ? raw < 0 : raw < 1) {
      errors.push(`${key} is out of range.`);
      continue;
    }
    value[key] = raw;
  }

  const explicit = source.explicit;
  if (explicit !== undefined) {
    if (typeof explicit !== 'boolean') {
      errors.push('explicit must be a boolean.');
    } else {
      value.explicit = explicit;
    }
  }

  if (artwork !== undefined) {
    validateArtwork(artwork, errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0 && artwork === undefined) {
    return { ok: false, errors: ['No tag changes provided.'] };
  }
  return { ok: true, value };
}
