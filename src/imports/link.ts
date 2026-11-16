export const YTMP3_ENDPOINT = 'https://ytmp3.ge/api/convert';
export const LINK_TIMEOUT_MS = 300_000;

export type LinkQuality = 128 | 192 | 256 | 320;

export const LINK_QUALITIES: readonly LinkQuality[] = [128, 192, 256, 320];
export const DEFAULT_LINK_QUALITY: LinkQuality = 192;

export type LinkTarget = { videoId: string; url: string };

export type LinkDownload = {
  videoId: string;
  title: string;
  thumbnail: string | null;
  durationMs: number;
  sizeBytes: number | null;
  downloadUrl: string;
};

export type LinkProgress = { phase: 'convert' | 'download' | 'thumbnail' | 'save' };

type LinkParseResult = ({ ok: true } & LinkTarget) | { ok: false; reason: string };

type ConvertResult = { ok: true; data: LinkDownload } | { ok: false; error: string };

const LINK_PATTERN = /^(https?):\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_URL = 'https://www.youtube.com/watch?v=';
const NO_SCHEME_REASON = 'Paste a full YouTube link starting with https://';
const WRONG_LINK_REASON = 'Only youtube.com/watch and youtu.be links work.';
const INVALID_ID_REASON = 'That link does not contain a valid video id.';

const ILLEGAL_NAME_CHARS = /[/\\?%*:|"<>]/g;
const AUDIO_VIDEO_EXTENSION =
  /\.(?:mp3|mp4|m4a|m4v|aac|wav|flac|ogg|oga|opus|webm|wma|aiff?|caf|mov|avi|mkv|3gp|mp2|mpg|mpeg)$/i;
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'heic', 'heif']);

const PROGRESS_LABELS: Record<LinkProgress['phase'], string> = {
  convert: 'Reading the link…',
  download: 'Downloading…',
  thumbnail: 'Saving artwork…',
  save: 'Adding to Library…',
};

function withVideoId(videoId: string): LinkParseResult {
  if (!VIDEO_ID.test(videoId)) return { ok: false, reason: INVALID_ID_REASON };
  return { ok: true, videoId, url: `${WATCH_URL}${videoId}` };
}

function recordOf(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

export function parseYoutubeInput(raw: string): LinkParseResult {
  const trimmed = raw.trim();
  const match = LINK_PATTERN.exec(trimmed);
  if (!match) {
    return { ok: false, reason: /^https?:\/\//i.test(trimmed) ? WRONG_LINK_REASON : NO_SCHEME_REASON };
  }

  const host = match[2]!.toLowerCase();
  const path = match[3] ?? '';
  const query = match[4] ?? '';

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return withVideoId(path.split('/')[1] ?? '');
  }

  if (host !== 'youtube.com' && host !== 'www.youtube.com') {
    return { ok: false, reason: WRONG_LINK_REASON };
  }

  const lowerPath = path.toLowerCase();
  if (lowerPath === '/playlist' || lowerPath.startsWith('/playlist/')) {
    return { ok: false, reason: 'Playlists are not supported. Paste a single video link instead.' };
  }
  if (lowerPath.startsWith('/embed')) {
    return {
      ok: false,
      reason: 'Embed links are not supported. Open the video on YouTube and copy the link.',
    };
  }
  if (lowerPath !== '/watch' && lowerPath !== '/watch/') {
    return { ok: false, reason: WRONG_LINK_REASON };
  }

  const videoParam = /(?:^|&)v=([^&]*)/.exec(query);
  return withVideoId(videoParam?.[1] ?? '');
}

export function buildConvertBody(target: LinkTarget, quality: LinkQuality): string {
  return `youtube_url=${encodeURIComponent(target.url)}&quality=${quality}`;
}

export function parseConvertResponse(raw: string): ConvertResult {
  const payload = recordOf(raw);
  if (!payload) {
    return { ok: false, error: 'The download service sent an unexpected response.' };
  }

  if (payload.success === false) {
    const message = cleanText(payload.error);
    return {
      ok: false,
      error: message
        ? message.slice(0, 180).trimEnd()
        : 'The download service could not convert this link.',
    };
  }

  if (payload.success !== true || !isHttpUrl(payload.downloadUrl)) {
    return { ok: false, error: 'The download service did not return a file.' };
  }

  const duration = numericValue(payload.duration);

  return {
    ok: true,
    data: {
      videoId: typeof payload.videoId === 'string' ? payload.videoId : '',
      title: cleanText(payload.title) ?? 'YouTube audio',
      thumbnail: isHttpUrl(payload.thumbnail) ? payload.thumbnail : null,
      durationMs: duration === null ? 0 : Math.round(duration * 1000),
      sizeBytes: numericValue(payload.size),
      downloadUrl: payload.downloadUrl,
    },
  };
}

export function linkFileName(title: string): string {
  const cleaned = title
    .replace(ILLEGAL_NAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(AUDIO_VIDEO_EXTENSION, '')
    .replace(/[. ]+$/g, '');
  const base = cleaned.slice(0, 80).replace(/[. ]+$/g, '');
  return `${base || 'youtube-audio'}.mp3`;
}

export function thumbnailExtension(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const extension = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase();
  return extension && IMAGE_EXTENSIONS.has(extension) ? extension : 'jpg';
}

export function linkProgressLabel(progress: LinkProgress): string {
  return PROGRESS_LABELS[progress.phase];
}
