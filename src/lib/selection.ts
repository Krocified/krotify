export type Selection = ReadonlySet<string>;

export type SelectionState = 'none' | 'partial' | 'all';

export function toggleId(selected: Selection, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectVisible(selected: Selection, visibleIds: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of visibleIds) next.add(id);
  return next;
}

export function clearSelection(): Set<string> {
  return new Set();
}

export function selectionState(
  selected: Selection,
  visibleIds: readonly string[],
): SelectionState {
  if (visibleIds.length === 0) return 'none';
  let covered = 0;
  for (const id of visibleIds) if (selected.has(id)) covered += 1;
  if (covered === 0) return 'none';
  return covered === visibleIds.length ? 'all' : 'partial';
}

export function toggleAllVisible(
  selected: Selection,
  visibleIds: readonly string[],
): Set<string> {
  if (selectionState(selected, visibleIds) === 'all') {
    const next = new Set(selected);
    for (const id of visibleIds) next.delete(id);
    return next;
  }
  return selectVisible(selected, visibleIds);
}

export function selectionBackHandler(
  active: boolean,
  exit: () => void,
): (() => boolean) | null {
  if (!active) return null;
  return () => {
    exit();
    return true;
  };
}
