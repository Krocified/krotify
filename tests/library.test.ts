import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTracks, mergeTracks, tracksFromPage, toTrack } from '../src/lib/library.ts';

const meta = (id: string, filename: string) => ({ id, filename, durationMs: 200_000 });

test('toTrack maps filename to title and seeds hue', () => {
  const track = toTrack(meta('1', '02 - Blue Monday.mp3'));
  assert.equal(track.id, '1');
  assert.equal(track.title, 'Blue Monday');
  assert.equal(track.uri, '');
  assert.equal(track.source, 'scan');
  assert.equal(track.artist, '');
  assert.equal(track.album, '');
  assert.ok(track.artworkHue >= 0 && track.artworkHue <= 359);
});

test('sortTracks is case-insensitive A to Z', () => {
  const tracks = [toTrack(meta('1', 'zeta.mp3')), toTrack(meta('2', 'Alpha.mp3')), toTrack(meta('3', 'beta.mp3'))];
  assert.deepEqual(sortTracks(tracks).map((t) => t.title), ['Alpha', 'beta', 'zeta']);
});

test('mergeTracks dedupes by id and keeps existing order', () => {
  const existing = [toTrack(meta('1', 'one.mp3'))];
  const merged = mergeTracks(existing, [toTrack(meta('1', 'one-again.mp3')), toTrack(meta('2', 'two.mp3'))]);
  assert.deepEqual(merged.map((t) => t.id), ['1', '2']);
  assert.equal(merged[0].title, 'one');
});

test('tracksFromPage maps, dedupes and sorts', () => {
  const page = tracksFromPage([meta('2', 'b.mp3'), meta('1', 'c.mp3'), meta('2', 'b2.mp3')]);
  assert.deepEqual(page.map((t) => t.id), ['2', '1']);
  assert.deepEqual(page.map((t) => t.title), ['b', 'c']);
});
