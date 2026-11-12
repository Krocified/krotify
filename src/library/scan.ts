import { Asset, AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';
import type { Track } from '../types';
import { tracksFromPage, type AssetMeta } from '../lib/library';

const PAGE = 200;
const MIN_DURATION_MS = 3000;
const SYSTEM_PATH = /(ringtones|notifications|alarms|ui|system)/i;

const baseQuery = () =>
  new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false });

export async function ensureAudioPermission(): Promise<boolean> {
  const response = await requestPermissionsAsync(false, ['audio']);
  return response.granted;
}

export async function scanLibrary(): Promise<{ tracks: Track[]; assets: Map<string, Asset> }> {
  const metas: AssetMeta[] = [];
  const assets = new Map<string, Asset>();
  const uriById = new Map<string, string>();

  for (let offset = 0; ; offset += PAGE) {
    const [pageAssets, pageMetadata] = await Promise.all([
      baseQuery().offset(offset).limit(PAGE).exe(),
      baseQuery().offset(offset).limit(PAGE).exeForMetadata(),
    ]);
    if (pageAssets.length === 0) break;
    const metaById = new Map(pageMetadata.map((meta) => [meta.id, meta]));
    const uris = await Promise.all(pageAssets.map((asset) => asset.getUri().catch(() => '')));
    pageAssets.forEach((asset, index) => {
      const meta = metaById.get(asset.id);
      const uri = uris[index] ?? '';
      const durationMs = Math.round(meta?.duration ?? 0);
      if (durationMs > 0 && durationMs < MIN_DURATION_MS) return;
      if (SYSTEM_PATH.test(uri)) return;
      assets.set(asset.id, asset);
      metas.push({ id: asset.id, filename: meta?.filename ?? '', durationMs });
      uriById.set(asset.id, uri);
    });
    if (pageAssets.length < PAGE) break;
  }

  const tracks = tracksFromPage(metas).map((track) => ({
    ...track,
    uri: uriById.get(track.id) ?? '',
  }));
  return { tracks, assets };
}
