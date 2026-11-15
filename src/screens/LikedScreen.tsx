import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollectionHeader } from '../components/CollectionHeader';
import { BackPill, ScreenHeader } from '../components/ScreenHeader';
import { TrackRow } from '../components/TrackRow';
import { useFavorites } from '../library/FavoritesProvider';
import { formatDuration } from '../lib/format';
import { hueFromSeed } from '../lib/hash';
import { shuffleOrder } from '../lib/shuffle';
import { colors, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks?: Track[];
  onClose: () => void;
  onPlay: (queue: Track[]) => void;
  onSelect?: (track: Track, queue: Track[]) => void;
};

export function LikedScreen({ tracks = [], onClose, onPlay, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { ids } = useFavorites();
  const favoriteTracks = useMemo(
    () => tracks.filter((track) => ids.has(track.id)),
    [ids, tracks],
  );
  const artwork = useMemo(
    () => ({
      hue: favoriteTracks[0]?.artworkHue ?? hueFromSeed('liked-songs'),
      uri: favoriteTracks.find((track) => Boolean(track.artworkUri))?.artworkUri,
    }),
    [favoriteTracks],
  );
  const totalMs = useMemo(
    () => favoriteTracks.reduce((sum, track) => sum + (track.durationMs || 0), 0),
    [favoriteTracks],
  );

  const play = () => {
    if (favoriteTracks.length > 0) onPlay(favoriteTracks);
  };

  const shuffle = () => {
    if (favoriteTracks.length > 0) {
      onPlay(shuffleOrder(favoriteTracks, -1, Math.random).order);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader leading={<BackPill onPress={onClose} />} title="Liked Songs" />
      <FlatList
        data={favoriteTracks}
        keyExtractor={(track) => track.id}
        ListHeaderComponent={
          <CollectionHeader
            title="Liked Songs"
            meta={`${favoriteTracks.length} ${
              favoriteTracks.length === 1 ? 'song' : 'songs'
            } · ${formatDuration(totalMs)}`}
            artworkUri={artwork.uri}
            fallbackHue={artwork.hue}
            onPlay={play}
            onShuffle={shuffle}
            disabled={favoriteTracks.length === 0}
          />
        }
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            onPress={(track) =>
              onSelect ? onSelect(track, favoriteTracks) : onPlay(favoriteTracks)
            }
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={34} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No liked songs yet</Text>
            <Text style={styles.emptyText}>
              {"Tap the heart in Now Playing or in a song's action sheet."}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.xl * 2,
  },
  emptyTitle: {
    ...type.body,
    color: colors.text,
  },
  emptyText: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
