export function tracksToAppend(
  existingIds: readonly string[],
  selectedIds: readonly string[],
): string[] {
  const existing = new Set(existingIds);
  const next: string[] = [];
  for (const id of selectedIds) {
    if (existing.has(id) || next.includes(id)) continue;
    next.push(id);
  }
  return next;
}

export function appendPositions(maxPosition: number, count: number): number[] {
  const base = maxPosition > 0 ? maxPosition : 0;
  return Array.from({ length: Math.max(0, count) }, (_, index) => base + (index + 1) * 1000);
}

export function bulkAddMessage(
  added: number,
  playlistCount: number,
  failures: readonly string[],
): string {
  const songs = `${added} ${added === 1 ? 'song' : 'songs'}`;
  const succeeded = Math.max(0, playlistCount - failures.length);
  const playlists = `${succeeded} ${succeeded === 1 ? 'playlist' : 'playlists'}`;
  const base = `Added ${songs} to ${playlists}`;
  if (failures.length === 0) return base;
  return `${base}. Failed: ${failures.join(', ')}`;
}
