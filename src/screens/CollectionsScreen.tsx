import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollectionHeader } from '../components/CollectionHeader';
import { CoverArt } from '../components/CoverArt';
import { BackPill, HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { buildArtists, type Artist } from '../lib/groups';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  visible: boolean;
  tracks: Track[];
  likedCount: number;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenLiked: () => void;
  onOpenPlaylists: () => void;
  onPlay: (queue: Track[]) => void;
  onSelect: (track: Track, queue: Track[]) => void;
};

type Selection = { kind: 'artist'; key: string };

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function artistMeta(artist: Artist): string {
  return `${countLabel(artist.albumCount, 'album')} · ${countLabel(artist.tracks.length, 'track')}`;
}

export function CollectionsScreen({
  visible,
  tracks,
  likedCount,
  onOpenSearch,
  onOpenSettings,
  onOpenLiked,
  onOpenPlaylists,
  onPlay,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection | null>(null);
  const artists = useMemo(() => buildArtists(tracks), [tracks]);

  const artist = selection?.kind === 'artist'
    ? artists.find((item) => item.key === selection.key) ?? null
    : null;
  const detail = artist;
  const detailTitle = artist ? artist.name : '';
  const detailMeta = artist ? artistMeta(artist) : '';
  const detailTracks = artist ? artist.tracks : [];
  const detailHue = artist?.tracks[0]?.artworkHue ?? 0;

  const bottomPad = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + insets.bottom + space.xl;

  return (
    <View
      style={[styles.root, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <ScreenHeader
        leading={
          selection ? (
            <BackPill onPress={() => setSelection(null)} label="Back to collections" />
          ) : (
            <Ionicons name="albums-outline" size={26} color={colors.text} />
          )
        }
        title={detail ? detailTitle : 'Collections'}
        trailing={
          selection ? undefined : (
            <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
          )
        }
      />

      {detail ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          <CollectionHeader
            title={detailTitle}
            meta={detailMeta}
            artworkUri={detailTracks[0]?.artworkUri}
            fallbackHue={detailHue}
            onPlay={() => onPlay(detailTracks)}
            onShuffle={() => onPlay(shuffle(detailTracks))}
          />
          <View style={styles.list}>
            {detailTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                onPress={(item) => onSelect(item, detailTracks)}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          <View style={styles.card}>
            <Pressable
              onPress={onOpenLiked}
              accessibilityRole="button"
              accessibilityLabel={`Liked Songs, ${countLabel(likedCount, 'song')}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.likedIcon}>
                <Ionicons name="heart" size={22} color={colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Liked Songs</Text>
                <Text style={styles.rowMeta}>{countLabel(likedCount, 'song')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
            </Pressable>
            <Pressable
              onPress={onOpenPlaylists}
              accessibilityRole="button"
              accessibilityLabel="Playlists"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.plainIcon}>
                <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Playlists</Text>
                <Text style={styles.rowMeta}>Collections you made</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Artists</Text>
          <View style={styles.card}>
            {artists.length === 0 ? (
              <Text style={styles.empty}>No artists yet.</Text>
            ) : (
              artists.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setSelection({ kind: 'artist', key: item.key })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${artistMeta(item)}`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <CoverArt
                    hue={item.tracks[0]?.artworkHue ?? 0}
                    title={item.name}
                    size={48}
                    radius={24}
                    uri={item.tracks[0]?.artworkUri}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowMeta}>{artistMeta(item)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function shuffle(queue: Track[]): Track[] {
  const copy = [...queue];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as Track, copy[index] as Track];
  }
  return copy;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
  },
  hidden: {
    display: 'none',
  },
  content: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  list: {
    paddingHorizontal: space.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  pressed: {
    backgroundColor: colors.surfaceHi,
  },
  likedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent2,
  },
  plainIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  sectionTitle: {
    ...type.meta,
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: space.xs,
    marginTop: space.sm,
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    padding: space.md,
  },
});
