export type TagCount = { id: string; name: string; count: number };

const byName = (a: { name: string }, b: { name: string }) => {
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
};

export function visibleTags(tags: TagCount[]): TagCount[] {
  return tags.filter((tag) => tag.count > 0).sort(byName);
}

export function tagBarVisible(tags: TagCount[]): boolean {
  return visibleTags(tags).length > 0;
}

export function reconcileTagFilter(selected: string | null, tags: TagCount[]): string | null {
  if (selected === null) return null;
  return visibleTags(tags).some((tag) => tag.id === selected) ? selected : null;
}

export function filterTracksByTag<T extends { id: string }>(
  tracks: T[],
  tagId: string | null,
  assignments: ReadonlyMap<string, readonly string[]>,
): T[] {
  if (tagId === null) return tracks.slice();
  return tracks.filter((track) => assignments.get(track.id)?.includes(tagId) === true);
}

export function assignmentsFromRows(
  rows: { trackId: string; tagId: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const current = map.get(row.trackId);
    if (current) current.push(row.tagId);
    else map.set(row.trackId, [row.tagId]);
  }
  return map;
}

export function setAssignment(
  map: ReadonlyMap<string, readonly string[]>,
  trackId: string,
  tagId: string,
  assigned: boolean,
): Map<string, string[]> {
  const next = new Map<string, string[]>();
  for (const [key, value] of map) next.set(key, [...value]);
  const current = next.get(trackId) ?? [];
  if (assigned) {
    if (!current.includes(tagId)) next.set(trackId, [...current, tagId]);
    return next;
  }
  const filtered = current.filter((id) => id !== tagId);
  if (filtered.length === 0) next.delete(trackId);
  else next.set(trackId, filtered);
  return next;
}
