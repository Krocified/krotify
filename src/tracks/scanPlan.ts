import type { ScanTrackInput } from './types.ts';

export function ownedKey(
  fileName: string,
  sizeBytes: number | undefined,
): string | null {
  if (!fileName) return null;
  if (
    typeof sizeBytes !== 'number' ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return null;
  }
  return `${fileName}:${sizeBytes}`;
}

function underRoot(location: string, rootUri: string | null): boolean {
  if (!rootUri || !rootUri.startsWith('file://')) return false;
  const root = rootUri.endsWith('/') ? rootUri.slice(0, -1) : rootUri;
  if (root.length <= 'file://'.length) return false;
  return location.startsWith(`${root}/`);
}

export function filterScanCandidates(
  candidates: ScanTrackInput[],
  options: { rootUri: string | null; ownedKeys: ReadonlySet<string> },
): { accepted: ScanTrackInput[]; skippedOwned: number } {
  const accepted: ScanTrackInput[] = [];
  let skippedOwned = 0;

  for (const candidate of candidates) {
    if (underRoot(candidate.location, options.rootUri)) {
      skippedOwned += 1;
      continue;
    }
    const key = ownedKey(candidate.fileName, candidate.sizeBytes);
    if (key !== null && options.ownedKeys.has(key)) {
      skippedOwned += 1;
      continue;
    }
    accepted.push(candidate);
  }

  return { accepted, skippedOwned };
}
