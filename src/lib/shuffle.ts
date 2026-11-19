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

export function shuffleUpcoming(
  queue: Track[],
  currentIndex: number,
  random: () => number,
): ShuffleResult {
  if (currentIndex < 0 || currentIndex >= queue.length) {
    return { order: [...queue], index: currentIndex };
  }
  const head = queue.slice(0, currentIndex + 1);
  const tail = shuffleOrder(queue.slice(currentIndex + 1), -1, random).order;
  return { order: [...head, ...tail], index: currentIndex };
}

export function restoreUpcoming(
  queue: Track[],
  original: Track[],
  currentIndex: number,
): ShuffleResult {
  if (currentIndex < 0 || currentIndex >= queue.length) {
    return { order: [...queue], index: currentIndex };
  }
  const head = queue.slice(0, currentIndex + 1);
  const played = new Set(head.map((track) => track.id));
  const tail = original.filter((track) => !played.has(track.id));
  return { order: [...head, ...tail], index: currentIndex };
}
