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

export type PickedImage = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export type ImagePickerAssetLike = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  gif: 'image/gif',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
};

function extensionOf(uri: string): string | null {
  const clean = uri.split('?')[0].split('#')[0];
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(clean);
  return match ? match[1].toLowerCase() : null;
}

export function pickedImageFromAsset(asset: ImagePickerAssetLike): PickedImage {
  const extension = extensionOf(asset.uri);
  const declaredMime = asset.mimeType?.split(';')[0]?.trim().toLowerCase();
  const mimeType = declaredMime && declaredMime.startsWith('image/')
    ? declaredMime
    : (extension ? MIME_BY_EXTENSION[extension] : undefined) ?? 'image/jpeg';
  const suffix = EXTENSION_BY_MIME[mimeType] ?? (extension ?? 'jpg');
  const name = asset.fileName?.trim() || `artwork-${Date.now()}.${suffix}`;
  const sizeBytes =
    typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize) && asset.fileSize > 0
      ? asset.fileSize
      : 0;
  return { uri: asset.uri, name, mimeType, sizeBytes };
}
