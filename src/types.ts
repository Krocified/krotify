export type Track = {
  id: string;
  uri: string;
  source: 'scan' | 'import' | 'demo';
  missing: 0 | 1;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkHue: number;
  artworkUri?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  albumArtist?: string;
  explicit?: boolean;
};

export type ScreenName =
  | 'library'
  | 'import'
  | 'search'
  | 'nowPlaying'
  | 'settings';

export type LibraryStatus = 'scanning' | 'ready' | 'denied' | 'empty' | 'error';
