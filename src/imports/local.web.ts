import type { ImportResult } from './plan.ts';

export async function pickAndImportTracks(): Promise<ImportResult> {
  return { added: [], skipped: [], failures: [] };
}
