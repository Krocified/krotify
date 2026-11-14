const SYSTEM_AUDIO = /(^|[^a-z])(ringtones?|notifications?|alarms?|ui)([^a-z]|$)/i;

export function isSystemAudioLabel(value: string): boolean {
  return SYSTEM_AUDIO.test(value);
}

type AudioCandidate = {
  durationMs: number;
  uri?: string;
  filename?: string;
  albums?: string[];
};

export function shouldIncludeAudio({ durationMs, uri, filename, albums }: AudioCandidate): boolean {
  if (durationMs > 0 && durationMs < 3000) return false;
  if (uri && isSystemAudioLabel(uri)) return false;
  if (filename && isSystemAudioLabel(filename)) return false;
  if (albums?.some(isSystemAudioLabel)) return false;
  return true;
}
