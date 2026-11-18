export type ImportProgress = { index: number; total: number; name: string };

export function importProgressLabel(progress: ImportProgress): string {
  if (!Number.isFinite(progress.total) || progress.total <= 0) {
    return `Importing — ${progress.name}`;
  }
  return `Importing ${progress.index} of ${progress.total} — ${progress.name}`;
}

export function importProgressFraction(progress: ImportProgress): number {
  if (!Number.isFinite(progress.total) || progress.total <= 0) return 0;
  if (!Number.isFinite(progress.index) || progress.index <= 0) return 0;
  return Math.min(1, progress.index / progress.total);
}
