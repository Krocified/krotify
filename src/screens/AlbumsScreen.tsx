import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  type ListViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { BackPill, HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { buildAlbums, type Album } from '../lib/groups';
import { loadArtwork } from '../library/metadata';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
  onArtworkLoaded: (trackId: string, uri: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

const BOTTOM_PAD = 66 + TAB_BAR_HEIGHT;

export function AlbumsScreen({
  tracks,
  onSelect,
  onArtworkLoaded,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albums = useMemo(() => buildAlbums(tracks), [tracks]);
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
        const first = item.tracks[0];
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

  const selected = selectedKey ? albums.find((album) => album.key === selectedKey) : null;
  const closeDetail = () => setSelectedKey(null);
  const coverSize = (width - space.md * 2 - space.md) / 2;

  const [fade] = useState(() => new Animated.Value(1));

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fade, selectedKey]);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      {selected ? (
        <>
          <ScreenHeader
            leading={<BackPill onPress={closeDetail} />}
            title={selected.title}
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <FlatList
            key={selected.key}
            data={selected.tracks}
            keyExtractor={(track) => track.id}
            renderItem={({ item }) => (
              <TrackRow track={item} onPress={(track) => onSelect(track, selected.tracks)} />
            )}
            contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
          />
        </>
      ) : (
        <>
          <ScreenHeader
            leading={<Ionicons name="albums-outline" size={26} color={colors.text} />}
            title="Albums"
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <FlatList
            key="albums"
            data={albums}
            keyExtractor={(album) => album.key}
            numColumns={2}
            columnWrapperStyle={styles.column}
            contentContainerStyle={[
              styles.grid,
              { paddingBottom: BOTTOM_PAD + insets.bottom },
            ]}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <AlbumCard
                album={item}
                size={coverSize}
                uri={item.tracks[0]?.artworkUri}
                onPress={() => setSelectedKey(item.key)}
              />
            )}
          />
        </>
      )}
    </Animated.View>
  );
}

type CardProps = {
  album: Album;
  size: number;
  uri?: string;
  onPress: () => void;
};

function AlbumCard({ album, size, uri, onPress }: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${album.title} by ${album.artist}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <CoverArt
        hue={album.artworkHue}
        title={album.title}
        size={size}
        radius={radius.coverLarge}
        uri={uri}
      />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={styles.cardArtist} numberOfLines={1}>
        {album.artist}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  grid: {
    paddingHorizontal: space.md,
    gap: space.lg,
  },
  column: {
    gap: space.md,
  },
  card: {
    flex: 1,
    gap: space.xs,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardTitle: {
    ...type.body,
    color: colors.text,
  },
  cardArtist: {
    ...type.meta,
    color: colors.textDim,
  },
});
