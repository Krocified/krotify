import {
  Album,
  Asset,
  AssetField,
  MediaType,
  Query,
  requestPermissionsAsync,
  type AssetMetadata,
} from 'expo-media-library';
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

function candidateFrom(
  meta: AssetMetadata,
  location: string,
  sizeBytes: number | undefined,
): ScanTrackInput {
  const candidate: ScanTrackInput = {
    id: meta.id,
    location,
    fileName: meta.filename ?? '',
    durationMs: Math.round(meta.duration ?? 0),
  };
  if (sizeBytes !== undefined) candidate.sizeBytes = sizeBytes;
  return candidate;
}

export async function scanLibrary(
  knownLocations?: ReadonlyMap<string, string>,
): Promise<{
  candidates: ScanTrackInput[];
  assets: Map<string, Asset>;
}> {
  const candidates: ScanTrackInput[] = [];
  const assets = new Map<string, Asset>();
  const systemIds = await systemAssetIds();

  for (let offset = 0; ; offset += PAGE) {
    const page = await baseQuery().offset(offset).limit(PAGE).exeForMetadata();
    if (page.length === 0) break;

    for (const meta of page) {
      if (systemIds.has(meta.id)) continue;
      const filename = meta.filename ?? undefined;
      const durationMs = Math.round(meta.duration ?? 0);
      if (!shouldIncludeAudio({ durationMs, filename })) continue;

      const known = knownLocations?.get(meta.id);
      let location = known ?? '';
      let sizeBytes: number | undefined;
      const asset = new Asset(meta.id);

      if (!location) {
        location = await asset.getUri().catch(() => '');
        if (!location) continue;
        sizeBytes = sizeOf(location);
      }
      if (!shouldIncludeAudio({ durationMs, uri: location, filename })) continue;

      assets.set(meta.id, asset);
      candidates.push(candidateFrom(meta, location, sizeBytes));
    }

    if (page.length < PAGE) break;
  }

  return { candidates, assets };
}
