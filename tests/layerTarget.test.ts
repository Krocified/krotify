import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBlurLayer } from '../src/lib/layerTarget.ts';

const none = {
  details: false,
  liked: false,
  playlists: false,
  techStack: false,
  hidden: false,
  librarySettings: false,
  settings: false,
  search: false,
};

test('defaults to the base screen', () => {
  assert.equal(resolveBlurLayer(none), 'base');
});

test('visual stacking wins over open order', () => {
  assert.equal(
    resolveBlurLayer({ ...none, search: true, hidden: true, settings: true }),
    'hidden',
  );
  assert.equal(
    resolveBlurLayer({ ...none, hidden: true, librarySettings: true }),
    'hidden',
  );
  assert.equal(
    resolveBlurLayer({ ...none, librarySettings: true, settings: true }),
    'librarySettings',
  );
  assert.equal(
    resolveBlurLayer({ ...none, search: true, playlists: true, liked: true }),
    'liked',
  );
  assert.equal(
    resolveBlurLayer({ ...none, liked: true, details: true }),
    'details',
  );
});

test('each layer resolves on its own', () => {
  assert.equal(resolveBlurLayer({ ...none, details: true }), 'details');
  assert.equal(resolveBlurLayer({ ...none, liked: true }), 'liked');
  assert.equal(resolveBlurLayer({ ...none, playlists: true }), 'playlists');
  assert.equal(resolveBlurLayer({ ...none, techStack: true }), 'techStack');
  assert.equal(resolveBlurLayer({ ...none, hidden: true }), 'hidden');
  assert.equal(resolveBlurLayer({ ...none, librarySettings: true }), 'librarySettings');
  assert.equal(resolveBlurLayer({ ...none, settings: true }), 'settings');
  assert.equal(resolveBlurLayer({ ...none, search: true }), 'search');
});

test('every layer set resolves to the top of the stack', () => {
  assert.equal(
    resolveBlurLayer({
      details: true,
      liked: true,
      playlists: true,
      techStack: true,
      hidden: true,
      librarySettings: true,
      settings: true,
      search: true,
    }),
    'details',
  );
});
