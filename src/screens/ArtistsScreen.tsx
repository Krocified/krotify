import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { BackPill, HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { buildArtists, type Artist } from '../lib/groups';
import { loadArtwork } from '../library/metadata';
import { colors, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
  onArtworkLoaded: (trackId: string, uri: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

const BOTTOM_PAD = TAB_BAR_HEIGHT + 170;

export function ArtistsScreen({
  tracks,
  onSelect,
  onArtworkLoaded,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const artists = useMemo(() => buildArtists(tracks), [tracks]);
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 10 }), []);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      for (const { item } of viewableItems) {
        const artist = item as Artist;
        const first = artist.tracks[0];
        if (!first || first.artworkUri || requested.current.has(first.id)) continue;
        requested.current.add(first.id);
        loadArtwork(first)
          .then((uri) => {
            if (uri && mounted.current) onArtworkLoaded(first.id, uri);
          })
          .catch(() => {});
      }
    },
    [onArtworkLoaded],
  );

  const selected = selectedKey ? artists.find((artist) => artist.key === selectedKey) : null;
  const closeDetail = () => setSelectedKey(null);

  const albumLabel = selected && selected.albumCount === 1 ? 'album' : 'albums';
  const trackLabel = selected && selected.tracks.length === 1 ? 'track' : 'tracks';

  return (
    <View style={styles.root}>
      {selected ? (
        <>
          <ScreenHeader
            leading={<BackPill onPress={closeDetail} />}
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <FlatList
            key={selected.key}
            data={selected.tracks}
            keyExtractor={(track) => track.id}
            ListHeaderComponent={
              <View style={styles.hero}>
                <CoverArt
                  hue={selected.tracks[0]?.artworkHue ?? 0}
                  title={selected.name}
                  size={160}
                  radius={80}
                  uri={selected.tracks[0]?.artworkUri}
                />
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {selected.name}
                </Text>
                <Text style={styles.heroMeta}>
                  {selected.albumCount} {albumLabel} · {selected.tracks.length} {trackLabel}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TrackRow track={item} onPress={(track) => onSelect(track, selected.tracks)} />
            )}
            contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
          />
        </>
      ) : (
        <>
          <ScreenHeader
            leading={<Ionicons name="people-outline" size={26} color={colors.text} />}
            title="Artists"
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <FlatList
            key="artists"
            data={artists}
            keyExtractor={(artist) => artist.key}
            contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <ArtistRow artist={item} onPress={() => setSelectedKey(item.key)} />
            )}
          />
        </>
      )}
    </View>
  );
}

function ArtistRow({ artist, onPress }: { artist: Artist; onPress: () => void }) {
  const albumLabel = artist.albumCount === 1 ? 'album' : 'albums';
  const trackLabel = artist.tracks.length === 1 ? 'track' : 'tracks';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${artist.albumCount} ${albumLabel}, ${artist.tracks.length} ${trackLabel}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <CoverArt
        hue={artist.tracks[0]?.artworkHue ?? 0}
        title={artist.name}
        size={48}
        radius={24}
        uri={artist.tracks[0]?.artworkUri}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {artist.albumCount} {albumLabel} · {artist.tracks.length} {trackLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  hero: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },
  heroTitle: {
    ...type.display,
    color: colors.text,
    textAlign: 'center',
    marginTop: space.sm,
  },
  heroMeta: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
});
