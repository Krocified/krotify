export function sheetKeyboardMetrics(input: {
  keyboardHeight: number;
  bottomInset: number;
  viewportHeight: number;
}): { lift: number; maxHeight: number } {
  const keyboardHeight = Number.isFinite(input.keyboardHeight) ? Math.max(0, input.keyboardHeight) : 0;
  const bottomInset = Number.isFinite(input.bottomInset) ? Math.max(0, input.bottomInset) : 0;
  const viewportHeight = Number.isFinite(input.viewportHeight)
    ? Math.max(0, input.viewportHeight)
    : 0;
  const lift = Math.max(0, keyboardHeight - bottomInset);
  const capped = Math.min(viewportHeight * 0.88, viewportHeight - lift - 96);
  return { lift, maxHeight: Math.max(240, capped) };
}
