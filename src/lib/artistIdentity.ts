export function artistArtKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function artistSongsLabel(count: number): string {
  return `${count} ${count === 1 ? 'song' : 'songs'}`;
}

export function applyArtistArt<T extends { key: string; name: string }>(
  artists: readonly T[],
  covers: ReadonlyMap<string, string>,
): (T & { artworkUri?: string })[] {
  return artists.map((artist) => {
    const artworkUri = covers.get(artistArtKey(artist.name));
    return artworkUri ? { ...artist, artworkUri } : { ...artist };
  });
}
