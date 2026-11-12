import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { TrackRow } from '../components/TrackRow';
import { buildArtists, type Artist } from '../lib/groups';
import { colors, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
};

const BOTTOM_PAD = 88 + 56;

export function ArtistsScreen({ tracks, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const artists = useMemo(() => buildArtists(tracks), [tracks]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = selectedKey ? artists.find((artist) => artist.key === selectedKey) : null;

  if (selected) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Pressable
            onPress={() => setSelectedKey(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to artists"
            hitSlop={space.sm}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selected.name}
          </Text>
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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title}>Artists</Text>
      </View>
      <FlatList
        key="artists"
        data={artists}
        keyExtractor={(artist) => artist.key}
        contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
        renderItem={({ item }) => <ArtistRow artist={item} onPress={() => setSelectedKey(item.key)} />}
      />
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
        radius={4}
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
  headerTitle: {
    ...type.body,
    flex: 1,
    color: colors.text,
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
});
