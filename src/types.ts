export type Track = {
  id: string;
  uri: string;
  source: 'scan' | 'import' | 'demo';
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkHue: number;
  artworkUri?: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
  albumArtist?: string;
};

export type ScreenName =
  | 'library'
  | 'albums'
  | 'artists'
  | 'search'
  | 'nowPlaying'
  | 'settings';

export type LibraryStatus = 'scanning' | 'ready' | 'denied' | 'empty' | 'error';
