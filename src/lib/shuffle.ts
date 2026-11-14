import type { Track } from '../types';

export type ShuffleResult = {
  order: Track[];
  index: number;
};

export function shuffleOrder(queue: Track[], keepIndex: number, random: () => number): ShuffleResult {
  if (queue.length === 0) return { order: [], index: -1 };

  const keep = keepIndex >= 0 && keepIndex < queue.length ? queue[keepIndex] : null;
  const rest = keep
    ? [...queue.slice(0, keepIndex), ...queue.slice(keepIndex + 1)]
    : [...queue];

  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return keep ? { order: [keep, ...rest], index: 0 } : { order: rest, index: 0 };
}

export function restoreOrder(original: Track[], currentId: string): ShuffleResult {
  return {
    order: [...original],
    index: original.findIndex((track) => track.id === currentId),
  };
}
