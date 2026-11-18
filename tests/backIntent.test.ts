import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBack, type BackState } from '../src/lib/backIntent.ts';

const state = (over: Partial<BackState>): BackState => ({
  sleepOpen: false, editOpen: false, likedOpen: false, playlistsOpen: false,
  openPlaylistId: null, screen: 'library', tab: 'library', ...over,
});

test('closes the sleep panel before leaving Now Playing', () => {
  assert.equal(resolveBack(state({ sleepOpen: true, screen: 'nowPlaying' })), 'close-sleep');
});

test('closes the most recent overlay first', () => {
  assert.equal(resolveBack(state({ editOpen: true, likedOpen: true, playlistsOpen: true, openPlaylistId: 'p' })), 'close-edit');
  assert.equal(resolveBack(state({ likedOpen: true, playlistsOpen: true, openPlaylistId: 'p' })), 'close-liked');
  assert.equal(resolveBack(state({ playlistsOpen: true, openPlaylistId: 'p' })), 'close-playlist-detail');
  assert.equal(resolveBack(state({ playlistsOpen: true })), 'close-playlists');
});

test('leaves a tab for Library before arming exit', () => {
  assert.equal(resolveBack(state({ screen: 'import', tab: 'import' })), 'tab-to-library');
  assert.equal(resolveBack(state({})), 'arm-exit');
});

test('closes full-screen routes before tab navigation', () => {
  assert.equal(resolveBack(state({ screen: 'nowPlaying' })), 'close-now-playing');
  assert.equal(resolveBack(state({ screen: 'settings' })), 'close-settings');
  assert.equal(resolveBack(state({ screen: 'librarySettings' })), 'close-library-settings');
  assert.equal(resolveBack(state({ screen: 'search' })), 'close-search');
});

test('closes the hidden tracks page before Settings', () => {
  assert.equal(resolveBack(state({ screen: 'hiddenTracks' })), 'close-hidden-tracks');
});
