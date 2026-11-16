import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linkFileName,
  linkProgressLabel,
  parseInfoResponse,
  parseYoutubeInput,
  thumbnailExtension,
} from '../src/imports/link.ts';
import { normalizeLinkServerUrl } from '../src/imports/serverUrl.ts';

test('parses a realistic info response', () => {
  assert.deepEqual(
    parseInfoResponse(
      JSON.stringify({
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        durationMs: 213000,
      }),
    ),
    {
      ok: true,
      data: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        durationMs: 213000,
      },
    },
  );
});

test('defaults the title and thumbnail when they are missing', () => {
  assert.deepEqual(
    parseInfoResponse(JSON.stringify({ videoId: 'dQw4w9WgXcQ', durationMs: 0 })),
    {
      ok: true,
      data: {
        videoId: 'dQw4w9WgXcQ',
        title: 'YouTube audio',
        thumbnail: null,
        durationMs: 0,
      },
    },
  );
});

test('drops a non-http thumbnail', () => {
  const result = parseInfoResponse(
    JSON.stringify({ videoId: 'dQw4w9WgXcQ', title: 'A', thumbnail: 'not-a-url', durationMs: 1 }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.thumbnail, null);
});

test('rejects malformed or incomplete info responses', () => {
  for (const raw of [
    '<html>502</html>',
    '[]',
    'null',
    JSON.stringify({ title: 'A' }),
    JSON.stringify({ durationMs: '213000' }),
    JSON.stringify({ durationMs: -1 }),
    JSON.stringify({ durationMs: null }),
  ]) {
    assert.deepEqual(parseInfoResponse(raw), {
      ok: false,
      error: 'The service sent an unexpected response.',
    });
  }
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

test('derives a safe file name from the title', () => {
  assert.equal(linkFileName('AC/DC: Back in Black'), 'AC-DC- Back in Black.mp3');
  assert.equal(linkFileName('Song.mp4'), 'Song.mp3');
  assert.equal(linkFileName(''), 'youtube-audio.mp3');
});

test('caps the sanitized file name base at 80 characters', () => {
  assert.equal(linkFileName(`${'a'.repeat(100)}.mp3`), `${'a'.repeat(80)}.mp3`);
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

test('normalizes a link server url', () => {
  assert.equal(normalizeLinkServerUrl('  https://example.com/  '), 'https://example.com');
  assert.equal(
    normalizeLinkServerUrl('http://192.168.1.20:3000///'),
    'http://192.168.1.20:3000',
  );
  assert.equal(
    normalizeLinkServerUrl('https://example.com/krotify/'),
    'https://example.com/krotify',
  );
});

test('rejects an empty or invalid link server url', () => {
  for (const raw of ['', '   ', 'example.com', 'ftp://example.com', 'https://', 'nonsense']) {
    assert.equal(normalizeLinkServerUrl(raw), null, raw);
  }
});
