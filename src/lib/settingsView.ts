export type PermissionState = 'granted' | 'denied' | 'not-asked';

export type StorageView = {
  folderName: string;
  fileCount: number;
  totalBytes: number;
  reclaimableBytes: number;
};

export function permissionStateFromResponse(response: {
  granted: boolean;
  status: string;
}): PermissionState {
  if (response.granted) return 'granted';
  if (response.status === 'undetermined') return 'not-asked';
  return 'denied';
}

export function permissionLabel(
  state: PermissionState,
): 'Granted' | 'Not granted' | 'Not asked' {
  if (state === 'granted') return 'Granted';
  if (state === 'denied') return 'Not granted';
  return 'Not asked';
}

export function isMissingTrack(track: { missing?: 0 | 1 | boolean }): boolean {
  return track.missing === 1 || track.missing === true;
}

export function scanResultLabel(found: number, added: number, missing: number): string {
  return `${found} tracks, ${added} new, ${missing} missing`;
}

export function excludeAllMeta(count: number): string {
  if (count === 0) return 'No scanned tracks to exclude';
  return `${count} scanned tracks`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  let value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function hiddenTracksLabel(): string {
  return 'Hidden tracks';
}

export function moveFilesLabel(fileCount: number, bytes: number): string {
  return `Move ${fileCount} files (${formatBytes(bytes)})`;
}

export function reclaimableLabel(bytes: number): string {
  return `${formatBytes(bytes)} reclaimable`;
}
