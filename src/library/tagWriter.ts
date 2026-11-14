import { readTags, writeTags } from '../../modules/audio-tags';
import type { TagFields } from '../lib/tagPatch';
import { validateTagPatch } from '../lib/tagPatch';
import { getCachedMetadata, putCachedMetadata } from '../db/repo';
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

function toTagWriteError(error: unknown): TagWriteError {
  if (error instanceof TagWriteError) return error;
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const nativeCode = typeof candidate?.code === 'string' ? candidate.code : '';
  const code = NATIVE_CODES.has(nativeCode as TagWriteErrorCode)
    ? (nativeCode as TagWriteErrorCode)
    : 'WRITE_FAILED';
  const message = typeof candidate?.message === 'string' ? candidate.message : 'Tag write failed.';
  return new TagWriteError(code, message, error);
}

export async function applyTagEdit(track: Track, patch: Partial<TagFields>): Promise<Track> {
  const validation = validateTagPatch(patch);
  if (!validation.ok) {
    throw new TagWriteError('INVALID_PATCH', validation.errors.join(' '));
  }
  if (!track.uri) {
    throw new TagWriteError('UNAVAILABLE', 'Track has no file URI.');
  }

  const fields = validation.value;
  let original: TagFields;
  try {
    original = await readTags(track.uri);
  } catch (error) {
    throw toTagWriteError(error);
  }

  let written: TagFields;
  try {
    written = await writeTags(track.uri, fields);
  } catch (error) {
    throw toTagWriteError(error);
  }

  try {
    const cache = await getCachedMetadata(track.id);
    await putCachedMetadata(track.id, { ...cache, ...written, ...fields });
  } catch (error) {
    try {
      await writeTags(track.uri, original);
    } catch {
    }
    throw new TagWriteError('CACHE_FAILED', 'Could not update the metadata cache.', error);
  }

  return { ...track, ...written, ...fields };
}
