import type { ScreenName } from '../types';

export type BackTab = 'library' | 'import' | 'collections';

export type BackState = {
  sleepOpen: boolean;
  editOpen: boolean;
  likedOpen: boolean;
  playlistsOpen: boolean;
  openPlaylistId: string | null;
  screen: ScreenName;
  tab: BackTab;
};

export type BackAction =
  | 'close-sleep'
  | 'close-edit'
  | 'close-liked'
  | 'close-playlist-detail'
  | 'close-playlists'
  | 'close-now-playing'
  | 'close-hidden-tracks'
  | 'close-tags'
  | 'close-settings'
  | 'close-search'
  | 'tab-to-library'
  | 'arm-exit';

export function resolveBack(state: BackState): BackAction {
  if (state.sleepOpen) return 'close-sleep';
  if (state.editOpen) return 'close-edit';
  if (state.likedOpen) return 'close-liked';
  if (state.playlistsOpen && state.openPlaylistId !== null) return 'close-playlist-detail';
  if (state.playlistsOpen) return 'close-playlists';
  if (state.screen === 'nowPlaying') return 'close-now-playing';
  if (state.screen === 'tags') return 'close-tags';
  if (state.screen === 'hiddenTracks') return 'close-hidden-tracks';
  if (state.screen === 'settings') return 'close-settings';
  if (state.screen === 'search') return 'close-search';
  if (state.screen !== 'library' || state.tab !== 'library') return 'tab-to-library';
  return 'arm-exit';
}
