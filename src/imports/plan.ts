import type { TrackRecord } from '../tracks/types.ts';

export type ImportFailureReason = 'unsupported' | 'no audio data' | 'copy failed';

export type ImportFailure = { name: string; reason: ImportFailureReason };

export type ImportSkip = { name: string; reason: 'duplicate' | 'hidden' };

export type ImportResult = {
  added: TrackRecord[];
  skipped: ImportSkip[];
  failures: ImportFailure[];
};

export type ImportCandidate = Pick<
  TrackRecord,
  'id' | 'status' | 'fileName' | 'sizeBytes' | 'location'
>;

export type ImportDecision =
  | { kind: 'insert' }
  | { kind: 'reactivate'; id: string; reuseFile: boolean }
  | { kind: 'duplicate'; id: string }
  | { kind: 'hidden'; id: string };

export function copyIsUsable(bytes: number | null | undefined): boolean {
  return typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0;
}

export function decideImport(
  existing: ImportCandidate[],
  key: { fileName: string; sizeBytes: number },
  fileExists: (location: string) => boolean,
): ImportDecision {
  const match = existing.find(
    (candidate) =>
      candidate.fileName === key.fileName && candidate.sizeBytes === key.sizeBytes,
  );

  if (!match) return { kind: 'insert' };
  if (match.status === 'active') return { kind: 'duplicate', id: match.id };
  if (match.status === 'hidden') return { kind: 'hidden', id: match.id };
  return { kind: 'reactivate', id: match.id, reuseFile: fileExists(match.location) };
}
