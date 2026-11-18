export function sheetKeyboardMetrics(input: {
  keyboardHeight: number;
  keyboardScreenY?: number | null;
  bottomInset: number;
  viewportHeight: number;
}): { lift: number; maxHeight: number } {
  const keyboardHeight = Number.isFinite(input.keyboardHeight) ? Math.max(0, input.keyboardHeight) : 0;
  const bottomInset = Number.isFinite(input.bottomInset) ? Math.max(0, input.bottomInset) : 0;
  const viewportHeight = Number.isFinite(input.viewportHeight)
    ? Math.max(0, input.viewportHeight)
    : 0;
  const screenY = Number.isFinite(input.keyboardScreenY)
    ? Math.max(0, input.keyboardScreenY as number)
    : null;
  const visibleHeight =
    screenY === null ? keyboardHeight : Math.min(keyboardHeight, viewportHeight - screenY);
  const lift = Math.max(0, visibleHeight - bottomInset);
  const capped = Math.min(viewportHeight * 0.88, viewportHeight - lift - 96);
  return { lift, maxHeight: Math.max(240, capped) };
}
