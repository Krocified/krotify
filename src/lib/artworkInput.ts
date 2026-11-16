export type ArtworkInput = {
  mimeType: string;
  sizeBytes: number;
};

export const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;

export type ArtworkValidation = { ok: true } | { ok: false; errors: string[] };

export function validateArtworkInput(input: ArtworkInput): ArtworkValidation {
  const errors: string[] = [];

  if (
    typeof input.mimeType !== 'string' ||
    !input.mimeType.toLowerCase().startsWith('image/')
  ) {
    errors.push('Artwork must be an image.');
  }

  if (
    typeof input.sizeBytes !== 'number' ||
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0
  ) {
    errors.push('Artwork size is invalid.');
  } else if (input.sizeBytes > MAX_ARTWORK_BYTES) {
    errors.push(`Artwork must be ${MAX_ARTWORK_BYTES} bytes or smaller.`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
