import type { ScreenName } from '../types.ts';

export type BackOwner =
  | 'nowPlaying'
  | 'liked'
  | 'playlists'
  | 'collections'
  | 'library'
  | 'hidden'
  | 'tags'
  | 'none';

export function activeBackOwner(input: {
  screen: ScreenName;
  tab: 'library' | 'import' | 'collections';
  likedOpen: boolean;
  playlistsOpen: boolean;
}): BackOwner {
  if (input.likedOpen) return 'liked';
  if (input.playlistsOpen) return 'playlists';
  if (input.screen === 'nowPlaying') return 'nowPlaying';
  if (input.screen === 'hiddenTracks') return 'hidden';
  if (input.screen === 'tags') return 'tags';
  if (input.screen === 'collections' && input.tab === 'collections') return 'collections';
  if (input.screen === 'library' && input.tab === 'library') return 'library';
  return 'none';
}
