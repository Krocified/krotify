export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

export function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[a-z0-9]{1,5}$/i, '');
  const withoutTrackNumber = withoutExtension.replace(/^\s*\d{1,3}\s*[-._)\]]+\s*/, '');
  const cleaned = withoutTrackNumber.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'Untitled';
}
