export type TrackSource = 'scan' | 'import' | 'download';

export type TrackStatus = 'active' | 'hidden' | 'removed';

export type TrackRecord = {
  id: string;
  source: TrackSource;
  location: string;
  fileName: string;
  sizeBytes?: number;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  explicit?: boolean;
  artworkUri?: string;
  status: TrackStatus;
  missing: 0 | 1;
  addedAt: number;
  lastSeenAt: number;
  artworkHue: number;
};

export type ScanTrackInput = {
  id: string;
  location: string;
  fileName: string;
  sizeBytes?: number;
  durationMs: number;
};

export type NewOwnedTrack = Omit<
  TrackRecord,
  'id' | 'status' | 'missing' | 'addedAt' | 'lastSeenAt' | 'artworkHue'
> & { artworkHue?: number };

export type TrackFieldPatch = Partial<
  Pick<
    TrackRecord,
    | 'location'
    | 'fileName'
    | 'sizeBytes'
    | 'durationMs'
    | 'title'
    | 'artist'
    | 'album'
    | 'albumArtist'
    | 'trackNumber'
    | 'discNumber'
    | 'year'
    | 'genre'
    | 'explicit'
    | 'artworkUri'
  >
>;
