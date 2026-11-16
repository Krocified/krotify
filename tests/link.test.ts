import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConvertBody,
  linkFileName,
  linkProgressLabel,
  parseConvertResponse,
  parseYoutubeInput,
  thumbnailExtension,
} from '../src/imports/link.ts';

const SUCCESS = JSON.stringify({
  success: true,
  videoId: 'dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  duration: 213,
  size: 3407872,
  downloadUrl: 'https://tmp.ytmp3.ge/dl/abc123.mp3',
});

test('parses a realistic success response', () => {
  assert.deepEqual(parseConvertResponse(SUCCESS), {
    ok: true,
    data: {
      videoId: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      durationMs: 213000,
      sizeBytes: 3407872,
      downloadUrl: 'https://tmp.ytmp3.ge/dl/abc123.mp3',
    },
  });
});

test('turns an error response into readable copy', () => {
  assert.deepEqual(
    parseConvertResponse(JSON.stringify({ success: false, error: 'This video is unavailable.' })),
    { ok: false, error: 'This video is unavailable.' },
  );
});

test('falls back when an error response has no message', () => {
  assert.deepEqual(parseConvertResponse(JSON.stringify({ success: false })), {
    ok: false,
    error: 'The download service could not convert this link.',
  });
});

test('cleans HTML from an error response', () => {
  assert.deepEqual(
    parseConvertResponse(JSON.stringify({ success: false, error: '<b>Rate</b>\n limited' })),
    { ok: false, error: 'Rate limited' },
  );
});

test('reports an unexpected response body', () => {
  assert.deepEqual(parseConvertResponse('<html>502</html>'), {
    ok: false,
    error: 'The download service sent an unexpected response.',
  });
});

test('rejects a success response without a file', () => {
  assert.deepEqual(parseConvertResponse(JSON.stringify({ success: true, title: 'A' })), {
    ok: false,
    error: 'The download service did not return a file.',
  });
});

test('accepts a watch link and canonicalizes it', () => {
  assert.deepEqual(
    parseYoutubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=10'),
    { ok: true, videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  );
});

test('accepts a youtu.be link and drops the timestamp', () => {
  assert.deepEqual(parseYoutubeInput('https://youtu.be/dQw4w9WgXcQ?t=43'), {
    ok: true,
    videoId: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
});

test('rejects a playlist link', () => {
  const result = parseYoutubeInput('https://www.youtube.com/playlist?list=PL123');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /Playlists are not supported/);
});

test('rejects an embed link', () => {
  const result = parseYoutubeInput('https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /Embed links are not supported/);
});

test('rejects invalid URLs and hosts', () => {
  for (const raw of [
    '',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=too-short',
    'https://youtu.be/',
  ]) {
    assert.equal(parseYoutubeInput(raw).ok, false, raw);
  }
});

test('builds the form body with the canonical url and quality', () => {
  assert.equal(
    buildConvertBody(
      { videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      192,
    ),
    'youtube_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&quality=192',
  );
});

test('derives a safe file name from the title', () => {
  assert.equal(linkFileName('AC/DC: Back in Black'), 'AC-DC- Back in Black.mp3');
  assert.equal(linkFileName('Song.mp4'), 'Song.mp3');
  assert.equal(linkFileName(''), 'youtube-audio.mp3');
});

test('reads the thumbnail extension', () => {
  assert.equal(thumbnailExtension('https://i.ytimg.com/vi/x/hqdefault.jpg'), 'jpg');
  assert.equal(thumbnailExtension('https://i.ytimg.com/vi/x/hqdefault.png'), 'png');
  assert.equal(thumbnailExtension('https://i.ytimg.com/vi/x/hqdefault'), 'jpg');
});

test('labels every download phase', () => {
  assert.equal(linkProgressLabel({ phase: 'convert' }), 'Reading the link…');
  assert.equal(linkProgressLabel({ phase: 'download' }), 'Downloading…');
  assert.equal(linkProgressLabel({ phase: 'thumbnail' }), 'Saving artwork…');
  assert.equal(linkProgressLabel({ phase: 'save' }), 'Adding to Library…');
});
