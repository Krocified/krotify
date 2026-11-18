import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBackOwner } from '../src/lib/backOwner.ts';

const base = {
  screen: 'library' as const,
  tab: 'library' as const,
  likedOpen: false,
  playlistsOpen: false,
};

test('the top visible layer owns back', () => {
  assert.equal(activeBackOwner(base), 'library');
  assert.equal(activeBackOwner({ ...base, screen: 'nowPlaying' }), 'nowPlaying');
  assert.equal(activeBackOwner({ ...base, likedOpen: true, screen: 'nowPlaying' }), 'liked');
  assert.equal(activeBackOwner({ ...base, playlistsOpen: true }), 'playlists');
  assert.equal(activeBackOwner({ ...base, screen: 'collections', tab: 'collections' }), 'collections');
  assert.equal(activeBackOwner({ ...base, screen: 'hiddenTracks' }), 'hidden');
  assert.equal(activeBackOwner({ ...base, screen: 'tags' }), 'tags');
});

test('screens without an interceptor own nothing', () => {
  assert.equal(activeBackOwner({ ...base, screen: 'search' }), 'none');
  assert.equal(activeBackOwner({ ...base, screen: 'settings' }), 'none');
  assert.equal(activeBackOwner({ ...base, screen: 'librarySettings' }), 'none');
  assert.equal(activeBackOwner({ ...base, screen: 'import', tab: 'import' }), 'none');
  assert.equal(activeBackOwner({ ...base, screen: 'collections', tab: 'library' }), 'none');
});
