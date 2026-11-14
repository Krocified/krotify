import type { CachedMetadata } from '../db/repo';
import type { ArtworkInput, TagFields } from '../lib/tagPatch';
import { validateTagPatch } from '../lib/tagPatch.ts';
import type { Track } from '../types';

export type TagWriteErrorCode =
  | 'INVALID_PATCH'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_NOT_FOUND'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'INVALID_ARTWORK'
  | 'NO_WRITE_ACCESS'
  | 'CACHE_FAILED';

const NATIVE_CODES = new Set<TagWriteErrorCode>([
  'UNSUPPORTED_FORMAT',
  'FILE_NOT_FOUND',
  'READ_FAILED',
  'WRITE_FAILED',
  'INVALID_ARTWORK',
  'NO_WRITE_ACCESS',
]);

export type TagEditDeps = {
  writeTags: (uri: string, fields: TagFields, artworkUri?: string) => Promise<TagFields>;
  snapshotFile: (uri: string) => Promise<string>;
  restoreFile: (uri: string, snapshotPath: string) => Promise<void>;
  discardSnapshot: (snapshotPath: string) => Promise<void>;
  getCachedMetadata: (id: string) => Promise<CachedMetadata | null>;
  putCachedMetadata: (id: string, meta: CachedMetadata) => Promise<void>;
};

export class TagWriteError extends Error {
  readonly code: TagWriteErrorCode;

  constructor(code: TagWriteErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'TagWriteError';
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', { value: cause, configurable: true });
    }
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const candidate = error as { message?: unknown } | null;
  return typeof candidate?.message === 'string' ? candidate.message : String(error);
}

function toTagWriteError(error: unknown): TagWriteError {
  if (error instanceof TagWriteError) return error;
  const candidate = error as { code?: unknown } | null;
  const nativeCode = typeof candidate?.code === 'string' ? candidate.code : '';
  const code = NATIVE_CODES.has(nativeCode as TagWriteErrorCode)
    ? (nativeCode as TagWriteErrorCode)
    : 'WRITE_FAILED';
  return new TagWriteError(code, messageOf(error), error);
}

async function loadNative() {
  return import('../../modules/audio-tags');
}

async function loadRepo() {
  return import('../db/repo');
}

const defaultDeps: TagEditDeps = {
  async writeTags(uri, fields, artworkUri) {
    return (await loadNative()).writeTags(uri, fields, artworkUri);
  },
  async snapshotFile(uri) {
    return (await loadNative()).snapshotFile(uri);
  },
  async restoreFile(uri, snapshotPath) {
    await (await loadNative()).restoreFile(uri, snapshotPath);
  },
  async discardSnapshot(snapshotPath) {
    await (await loadNative()).discardSnapshot(snapshotPath);
  },
  async getCachedMetadata(id) {
    return (await loadRepo()).getCachedMetadata(id);
  },
  async putCachedMetadata(id, meta) {
    await (await loadRepo()).putCachedMetadata(id, meta);
  },
};

export type TagEditArtwork = {
  artworkUri: string;
  artwork: ArtworkInput;
};

export function createTagWriter(deps: TagEditDeps) {
  return async function applyTagEdit(
    track: Track,
    patch: Partial<TagFields>,
    artwork?: TagEditArtwork,
  ): Promise<Track> {
    const validation = validateTagPatch(patch, artwork?.artwork);
    if (!validation.ok) {
      throw new TagWriteError('INVALID_PATCH', validation.errors.join(' '));
    }
    if (!track.uri) {
      throw new TagWriteError('UNAVAILABLE', 'Track has no file URI.');
    }

    const fields = validation.value;
    let snapshotPath: string;
    try {
      snapshotPath = await deps.snapshotFile(track.uri);
    } catch (error) {
      throw toTagWriteError(error);
    }

    let written: TagFields;
    try {
      written = await deps.writeTags(track.uri, fields, artwork?.artworkUri);
    } catch (error) {
      await deps.discardSnapshot(snapshotPath).catch(() => {});
      throw toTagWriteError(error);
    }

    const artworkCache = artwork ? { artworkUri: artwork.artworkUri } : undefined;
    try {
      const cache = await deps.getCachedMetadata(track.id);
      await deps.putCachedMetadata(track.id, {
        ...cache,
        ...written,
        ...fields,
        ...artworkCache,
      });
    } catch (cacheError) {
      try {
        await deps.restoreFile(track.uri, snapshotPath);
      } catch (restoreError) {
        throw new TagWriteError(
          'CACHE_FAILED',
          `Could not update the metadata cache and could not restore the original file: ${messageOf(
            restoreError,
          )}. Snapshot retained at ${snapshotPath}.`,
          restoreError,
        );
      }
      throw new TagWriteError(
        'CACHE_FAILED',
        'Could not update the metadata cache; restored the original file.',
        cacheError,
      );
    }

    await deps.discardSnapshot(snapshotPath).catch(() => {});
    return { ...track, ...written, ...fields, ...artworkCache };
  };
}

export const applyTagEdit = createTagWriter(defaultDeps);
