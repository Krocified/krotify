export function nextIndex(current: number, length: number): number {
  return current >= 0 && current < length - 1 ? current + 1 : -1;
}

export function previousIndex(current: number, length: number): number {
  return current > 0 && current < length ? current - 1 : -1;
}
