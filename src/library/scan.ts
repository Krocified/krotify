import { Album, Asset, AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';
import { File } from 'expo-file-system';
import type { ScanTrackInput } from '../tracks/types';
import { isSystemAudioLabel, shouldIncludeAudio } from '../lib/scanFilter';

const PAGE = 200;

const baseQuery = () =>
  new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false });

export async function ensureAudioPermission(): Promise<boolean> {
  const response = await requestPermissionsAsync(false, ['audio']);
  return response.granted;
}

async function systemAssetIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const albums = await Album.getAll();
    for (const album of albums) {
      try {
        const title = await album.getTitle();
        if (!isSystemAudioLabel(title)) continue;
        const assets = await album.getAssets();
        for (const asset of assets) ids.add(asset.id);
      } catch {
      }
    }
  } catch {
  }
  return ids;
}

function sizeOf(uri: string): number | undefined {
  try {
    const size = new File(uri).size;
    if (!Number.isFinite(size) || size <= 0) return undefined;
    return size;
  } catch {
    return undefined;
  }
}

export async function scanLibrary(): Promise<{
  candidates: ScanTrackInput[];
  assets: Map<string, Asset>;
}> {
  const candidates: ScanTrackInput[] = [];
  const assets = new Map<string, Asset>();
  const systemIds = await systemAssetIds();

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
      if (systemIds.has(asset.id)) return;
      if (!shouldIncludeAudio({ durationMs, uri, filename: meta?.filename ?? undefined })) return;
      assets.set(asset.id, asset);
      const candidate: ScanTrackInput = {
        id: asset.id,
        location: uri,
        fileName: meta?.filename ?? '',
        durationMs,
      };
      const sizeBytes = sizeOf(uri);
      if (sizeBytes !== undefined) candidate.sizeBytes = sizeBytes;
      candidates.push(candidate);
    });
    if (pageAssets.length < PAGE) break;
  }

  return { candidates, assets };
}
