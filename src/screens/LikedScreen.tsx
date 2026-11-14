import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackPill, ScreenHeader } from '../components/ScreenHeader';
import { TrackRow } from '../components/TrackRow';
import { useFavorites } from '../library/FavoritesProvider';
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

  const play = () => {
    if (favoriteTracks.length > 0) onPlay(favoriteTracks);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader leading={<BackPill onPress={onClose} />} title="Liked Songs" />
      <View style={styles.actions}>
        <Pressable
          onPress={play}
          disabled={favoriteTracks.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Play Liked Songs"
          accessibilityState={{ disabled: favoriteTracks.length === 0 }}
          style={({ pressed }) => [
            styles.playButton,
            favoriteTracks.length === 0 && styles.disabled,
            pressed && favoriteTracks.length > 0 && styles.pressed,
          ]}
        >
          <Ionicons name="play" size={18} color={colors.text} />
          <Text style={styles.playText}>Play all</Text>
        </Pressable>
        <Text style={styles.count}>
          {favoriteTracks.length} {favoriteTracks.length === 1 ? 'song' : 'songs'}
        </Text>
      </View>
      <FlatList
        data={favoriteTracks}
        keyExtractor={(track) => track.id}
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
            <Text style={styles.emptyText}>
              No liked songs yet. Tap the heart on a track or in its action sheet.
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  playButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: 21,
    backgroundColor: colors.accent,
  },
  playText: {
    ...type.body,
    color: colors.text,
  },
  count: {
    ...type.meta,
    color: colors.textDim,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
  empty: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl * 2,
  },
  emptyText: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
