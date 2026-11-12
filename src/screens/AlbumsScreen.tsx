import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { TrackRow } from '../components/TrackRow';
import { buildAlbums, type Album } from '../lib/groups';
import { loadArtwork } from '../library/metadata';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
};

const BOTTOM_PAD = 88 + 56;

export function AlbumsScreen({ tracks, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albums = useMemo(() => buildAlbums(tracks), [tracks]);
  const [artwork, setArtwork] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    for (const album of albums) {
      const first = album.tracks[0];
      if (!first || first.artworkUri || requested.current.has(album.key)) continue;
      requested.current.add(album.key);
      loadArtwork(first)
        .then((uri) => {
          if (uri) setArtwork((prev) => ({ ...prev, [album.key]: uri }));
        })
        .catch(() => {});
    }
  }, [albums]);

  const selected = selectedKey ? albums.find((album) => album.key === selectedKey) : null;

  if (selected) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Pressable
            onPress={() => setSelectedKey(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to albums"
            hitSlop={space.sm}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selected.title}
            </Text>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {selected.artist}
            </Text>
          </View>
          <View style={styles.iconButton} />
        </View>
        <FlatList
          key={selected.key}
          data={selected.tracks}
          keyExtractor={(track) => track.id}
          renderItem={({ item }) => (
            <TrackRow track={item} onPress={(track) => onSelect(track, selected.tracks)} />
          )}
          contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
        />
      </View>
    );
  }

  const coverSize = (width - space.md * 2 - space.md) / 2;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title}>Albums</Text>
      </View>
      <FlatList
        key="albums"
        data={albums}
        keyExtractor={(album) => album.key}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={[styles.grid, { paddingBottom: BOTTOM_PAD + insets.bottom }]}
        renderItem={({ item }) => (
          <AlbumCard
            album={item}
            size={coverSize}
            uri={item.tracks[0]?.artworkUri ?? artwork[item.key]}
            onPress={() => setSelectedKey(item.key)}
          />
        )}
      />
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  title: {
    ...type.display,
    color: colors.text,
  },
  headerText: {
    flex: 1,
    gap: space.xs,
  },
  headerTitle: {
    ...type.body,
    color: colors.text,
  },
  headerMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconPressed: {
    backgroundColor: colors.surfaceHi,
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
