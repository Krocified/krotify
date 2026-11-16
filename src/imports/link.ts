import type { TrackRecord } from '../tracks/types.ts';

export const LINK_TIMEOUT_MS = 300_000;

export type LinkTarget = { videoId: string; url: string };

export type LinkInfo = {
  videoId: string;
  title: string;
  thumbnail: string | null;
  durationMs: number;
};

export type LinkProgress = { phase: 'convert' | 'download' | 'thumbnail' | 'save' };

export type LinkImportOutcome =
  | { ok: true; record: TrackRecord }
  | { ok: false; error: string; cancelled?: boolean };

export type LinkImportOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: LinkProgress) => void;
};

type DownloadedFile = {
  uri: string;
  name: string;
  size: number;
  exists: boolean;
};

type LinkParseResult = ({ ok: true } & LinkTarget) | { ok: false; reason: string };

type InfoResult = { ok: true; data: LinkInfo } | { ok: false; error: string };

const LINK_PATTERN = /^(https?):\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_URL = 'https://www.youtube.com/watch?v=';
const NO_SCHEME_REASON = 'Paste a full YouTube link starting with https://';
const WRONG_LINK_REASON = 'Only youtube.com/watch and youtu.be links work.';
const INVALID_ID_REASON = 'That link does not contain a valid video id.';
const INFO_ERROR = 'The service sent an unexpected response.';
const MISSING_URL_ERROR = 'Set the link service URL in Settings first.';

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

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function serviceError(raw: string): string | null {
  const message = cleanText(recordOf(raw)?.error);
  return message ? message.slice(0, 180).trimEnd() : null;
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

export function parseInfoResponse(raw: string): InfoResult {
  const payload = recordOf(raw);
  if (!payload) return { ok: false, error: INFO_ERROR };

  const duration = payload.durationMs;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
    return { ok: false, error: INFO_ERROR };
  }

  return {
    ok: true,
    data: {
      videoId: typeof payload.videoId === 'string' ? payload.videoId : '',
      title: cleanText(payload.title) ?? 'YouTube audio',
      thumbnail: isHttpUrl(payload.thumbnail) ? payload.thumbnail : null,
      durationMs: duration,
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

const CANCELLED_ERROR = 'Download cancelled.';
const TIMEOUT_ERROR = 'The download service timed out. Try again.';
const NETWORK_ERROR = 'Could not reach the download service. Check your connection.';
const DOWNLOAD_ERROR =
  'Could not download the file. Check your connection and the storage folder.';
const EMPTY_ERROR = 'The downloaded file is empty.';
const UNPLAYABLE_ERROR = 'The service returned an unplayable file.';
const SAVE_ERROR = 'Could not add the download to the library.';

function cancelled(): LinkImportOutcome {
  return { ok: false, cancelled: true, error: CANCELLED_ERROR };
}

function timedOut(): LinkImportOutcome {
  return { ok: false, error: TIMEOUT_ERROR };
}

async function discard(uri: string): Promise<void> {
  try {
    const { deleteOwnedFile } = await import('../storage/root');
    await deleteOwnedFile(uri);
  } catch {}
}

async function saveThumbnail(info: LinkInfo, videoId: string): Promise<string | undefined> {
  if (!info.thumbnail) return undefined;
  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    const directory = new Directory(Paths.document, 'artwork');
    directory.create({ idempotent: true, intermediates: true });
    const name = `link-${videoId || Date.now()}.${thumbnailExtension(info.thumbnail)}`;
    const destination = new File(directory, name);
    await File.downloadFileAsync(info.thumbnail, destination, { idempotent: true });
    if (destination.exists && destination.size > 0) return destination.uri;
  } catch {}
  return undefined;
}

async function probeFile(uri: string): Promise<number> {
  try {
    const { probeDurationMs } = await import('./probe');
    return await probeDurationMs(uri);
  } catch {
    return 0;
  }
}

export async function importFromLink(
  rawUrl: string,
  options: LinkImportOptions = {},
): Promise<LinkImportOutcome> {
  const target = parseYoutubeInput(rawUrl);
  if (!target.ok) return { ok: false, error: target.reason };

  const { signal, onProgress } = options;
  const controller = new AbortController();
  let didTimeout = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let downloaded: DownloadedFile | null = null;

  const forwardAbort = () => {
    try {
      controller.abort();
    } catch {}
  };

  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort);

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const report = (phase: LinkProgress['phase']) => {
    try {
      onProgress?.({ phase });
    } catch {}
  };

  const stopReason = (): LinkImportOutcome | null => {
    if (signal?.aborted) return cancelled();
    if (didTimeout) return timedOut();
    return null;
  };

  try {
    if (signal?.aborted) return cancelled();

    timer = setTimeout(() => {
      didTimeout = true;
      forwardAbort();
    }, LINK_TIMEOUT_MS);

    let base = '';
    let token = '';
    try {
      // Native modules load lazily so this file still loads under node --test.
      const { loadLinkServerConfig } = await import('./serverConfig');
      const config = await loadLinkServerConfig();
      base = config.url;
      token = config.token;
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }

    if (!base) return { ok: false, error: MISSING_URL_ERROR };

    report('convert');

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['x-api-key'] = token;

    let info: LinkInfo;
    try {
      const response = await fetch(`${base}/info/${target.videoId}`, {
        headers,
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        return stopReason() ?? { ok: false, error: serviceError(raw) ?? INFO_ERROR };
      }
      const parsed = parseInfoResponse(raw);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      info = parsed.data;
    } catch {
      return stopReason() ?? { ok: false, error: NETWORK_ERROR };
    }

    const stopAfterInfo = stopReason();
    if (stopAfterInfo) return stopAfterInfo;

    report('download');

    let file: DownloadedFile;
    try {
      const { downloadOwnedFile } = await import('../storage/store');
      file = await downloadOwnedFile(`${base}/video/${target.videoId}`, linkFileName(info.title), {
        signal: controller.signal,
        headers: token ? { 'x-api-key': token } : undefined,
      });
    } catch {
      return stopReason() ?? { ok: false, error: DOWNLOAD_ERROR };
    }
    downloaded = file;

    if (!file.exists || file.size <= 0) {
      await discard(file.uri);
      return { ok: false, error: EMPTY_ERROR };
    }

    const durationMs = await probeFile(file.uri);
    if (durationMs <= 0) {
      await discard(file.uri);
      return { ok: false, error: UNPLAYABLE_ERROR };
    }

    const stopAfterProbe = stopReason();
    if (stopAfterProbe) {
      await discard(file.uri);
      return stopAfterProbe;
    }

    report('thumbnail');
    const artworkUri = await saveThumbnail(info, target.videoId);

    const stopAfterArtwork = stopReason();
    if (stopAfterArtwork) {
      await discard(file.uri);
      return stopAfterArtwork;
    }

    report('save');

    try {
      const { insertOwnedTrack } = await import('../tracks/repo');
      const record = await insertOwnedTrack({
        source: 'download',
        location: file.uri,
        fileName: file.name,
        sizeBytes: file.size > 0 ? file.size : undefined,
        durationMs,
        title: info.title,
        artist: '',
        album: '',
        artworkUri,
      });
      return { ok: true, record };
    } catch {
      await discard(file.uri);
      return { ok: false, error: SAVE_ERROR };
    }
  } catch {
    if (downloaded) await discard(downloaded.uri);
    return stopReason() ?? { ok: false, error: SAVE_ERROR };
  } finally {
    clearTimer();
    signal?.removeEventListener('abort', forwardAbort);
  }
}
