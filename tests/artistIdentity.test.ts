import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyArtistArt,
  artistArtKey,
  artistSongsLabel,
} from '../src/lib/artistIdentity.ts';

test('artistArtKey folds case and spacing', () => {
  assert.equal(artistArtKey('  The   Band '), 'the band');
  assert.equal(artistArtKey('The Band'), 'the band');
});

test('artistSongsLabel pluralizes', () => {
  assert.equal(artistSongsLabel(1), '1 song');
  assert.equal(artistSongsLabel(4), '4 songs');
  assert.equal(artistSongsLabel(0), '0 songs');
});

test('applyArtistArt matches by folded key and omits missing covers', () => {
  const artists = [
    { key: 'The Band', name: 'The Band' },
    { key: 'Other', name: 'Other' },
  ];
  const covers = new Map([['the band', 'file:///art.jpg']]);
  assert.deepEqual(applyArtistArt(artists, covers), [
    { key: 'The Band', name: 'The Band', artworkUri: 'file:///art.jpg' },
    { key: 'Other', name: 'Other' },
  ]);
});
