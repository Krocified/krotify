import { requireNativeModule } from 'expo-modules-core';
import type { TagFields } from '../../src/lib/tagPatch';

export type { TagFields };

type AudioTagsNativeModule = {
  readTags(uri: string): Promise<TagFields>;
  writeTags(uri: string, fields: TagFields, artworkUri?: string): Promise<TagFields>;
  requestWriteAccess(uris: string[]): Promise<string[]>;
};

function native(): AudioTagsNativeModule {
  return requireNativeModule<AudioTagsNativeModule>('AudioTags');
}

export function readTags(uri: string): Promise<TagFields> {
  return native().readTags(uri);
}

export function writeTags(uri: string, fields: TagFields, artworkUri?: string): Promise<TagFields> {
  return native().writeTags(uri, fields, artworkUri);
}

export function requestWriteAccess(uris: string[]): Promise<string[]> {
  return native().requestWriteAccess(uris);
}

export default { readTags, writeTags, requestWriteAccess };
