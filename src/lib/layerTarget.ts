export type BlurLayer =
  | 'details'
  | 'liked'
  | 'playlists'
  | 'collections'
  | 'techStack'
  | 'hidden'
  | 'settings'
  | 'search'
  | 'base';

export type LayerState = {
  details: boolean;
  liked: boolean;
  playlists: boolean;
  collections?: boolean;
  techStack?: boolean;
  hidden: boolean;
  settings: boolean;
  search: boolean;
};

export function resolveBlurLayer(state: LayerState): BlurLayer {
  if (state.details) return 'details';
  if (state.liked) return 'liked';
  if (state.playlists) return 'playlists';
  if (state.collections) return 'collections';
  if (state.techStack) return 'techStack';
  if (state.hidden) return 'hidden';
  if (state.settings) return 'settings';
  if (state.search) return 'search';
  return 'base';
}
