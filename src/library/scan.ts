import { Asset, AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';
import type { Track } from '../types';
import { tracksFromPage } from '../lib/library';

const PAGE = 200;

const baseQuery = () =>
  new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false });

export async function ensureAudioPermission(): Promise<boolean> {
  const response = await requestPermissionsAsync(false, ['audio']);
  return response.granted;
}

export async function scanLibrary(): Promise<{ tracks: Track[]; assets: Map<string, Asset> }> {
  const metas: { id: string; filename: string; durationMs: number }[] = [];
  const assets = new Map<string, Asset>();

  for (let offset = 0; ; offset += PAGE) {
    const [pageAssets, pageMetadata] = await Promise.all([
      baseQuery().offset(offset).limit(PAGE).exe(),
      baseQuery().offset(offset).limit(PAGE).exeForMetadata(),
    ]);
    if (pageAssets.length === 0) break;
    for (const asset of pageAssets) assets.set(asset.id, asset);
    for (const meta of pageMetadata) {
      metas.push({
        id: meta.id,
        filename: meta.filename ?? '',
        durationMs: Math.round(meta.duration ?? 0),
      });
    }
    if (pageAssets.length < PAGE) break;
  }

  return { tracks: tracksFromPage(metas), assets };
}
