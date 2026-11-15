function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/x-aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

const ILLEGAL = /[/\\?%*:|"<>]/g;

function extensionOfName(name: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return match ? match[1].toLowerCase() : null;
}

export function extensionForMime(mime: string | undefined): string | null {
  if (!mime) return null;
  const base = mime.split(';')[0]?.trim().toLowerCase();
  if (!base) return null;
  return MIME_EXTENSIONS[base] ?? null;
}

export function importedFileName(raw: string, fallback: string, mime?: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  let name = safeDecode(base).trim();
  if (/^(document|msf|content):/i.test(name)) {
    name = name.split(':').pop()?.trim() ?? name;
  }
  const cleaned = name.replace(ILLEGAL, '-').replace(/\s+/g, ' ').trim();
  const fallbackName = fallback.replace(ILLEGAL, '-').replace(/\s+/g, ' ').trim();
  const resolved = cleaned || fallbackName;
  if (!resolved) return 'track';
  if (extensionOfName(resolved)) return resolved;
  const mimeExtension = extensionForMime(mime);
  if (mimeExtension) return `${resolved}.${mimeExtension}`;
  const fallbackExtension = extensionOfName(fallbackName);
  if (fallbackExtension) return `${resolved}.${fallbackExtension}`;
  return resolved;
}
