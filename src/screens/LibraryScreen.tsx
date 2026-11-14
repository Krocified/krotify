import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { RecentlyPlayed } from '../components/RecentlyPlayed';
import { HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import type { Playlist } from '../db/repo';
import { hueFromSeed } from '../lib/hash';
import { colors, radius, space, type } from '../theme';
import type { LibraryStatus, Track } from '../types';

type Props = {
  tracks: Track[];
  recentTracks: Track[];
  status: LibraryStatus;
  statusNote: string | null;
  onSelect: (track: Track, queue: Track[]) => void;
  onManage: (track: Track) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  playlists?: Playlist[];
  likedCount?: number;
  onOpenLiked?: () => void;
  onOpenPlaylists?: () => void;
  onOpenPlaylist?: (id: string) => void;
};

const STATUS_NOTE: Partial<Record<LibraryStatus, string>> = {
  denied: 'Showing demo tracks. Allow audio access in Settings.',
  empty: 'No audio files found. Showing demo tracks.',
  error: 'Could not read your library. Showing demo tracks.',
};

export function LibraryScreen({
  tracks,
  recentTracks,
  status,
  statusNote,
  onSelect,
  onManage,
  onOpenSearch,
  onOpenSettings,
  playlists,
  likedCount = 0,
  onOpenLiked,
  onOpenPlaylists,
  onOpenPlaylist,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const listRef = useRef<FlatList<Track>>(null);
  const statusMessage = STATUS_NOTE[status] ?? null;
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8;

  return (
    <View style={styles.root}>
      <ScreenHeader
        leading={
          <>
            <Image
              source={require('../../assets/lyrics.png')}
              style={styles.brandIcon}
              accessible={false}
            />
            <Text style={styles.wordmark}>Krotify</Text>
          </>
        }
        trailing={
          <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
        }
      />

      {status === 'scanning' ? (
        <View style={styles.scanning}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.scanningText}>Scanning your library…</Text>
        </View>
      ) : (
        <>
          {statusMessage ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>{statusMessage}</Text>
            </View>
          ) : null}
          {statusNote ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>{statusNote}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              data={tracks}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TrackRow
                  track={item}
                  onPress={(track) => onSelect(track, tracks)}
                  onLongPress={() => onManage(item)}
                />
              )}
              ListHeaderComponent={
                recentTracks.length > 0 ||
                onOpenLiked !== undefined ||
                onOpenPlaylists !== undefined ||
                (playlists?.length ?? 0) > 0 ? (
                  <View>
                    {recentTracks.length > 0 ? (
                      <RecentlyPlayed tracks={recentTracks} onSelect={onSelect} />
                    ) : null}
                    {onOpenLiked ? (
                      <Pressable
                        onPress={onOpenLiked}
                        accessibilityRole="button"
                        accessibilityLabel={`Liked Songs, ${likedCount} ${likedCount === 1 ? 'song' : 'songs'}`}
                        style={({ pressed }) => [styles.likedRow, pressed && styles.rowPressed]}
                      >
                        <View style={styles.likedIcon}>
                          <Ionicons name="heart" size={24} color={colors.text} />
                        </View>
                        <View style={styles.likedText}>
                          <Text style={styles.likedTitle}>Liked Songs</Text>
                          <Text style={styles.likedMeta}>
                            {likedCount} {likedCount === 1 ? 'song' : 'songs'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                      </Pressable>
                    ) : null}
                    {onOpenPlaylists !== undefined || (playlists?.length ?? 0) > 0 ? (
                      <View style={styles.rails}>
                        <View style={styles.railHeader}>
                          <Text style={styles.railTitle}>Playlists</Text>
                          {onOpenPlaylists ? (
                            <Pressable
                              onPress={onOpenPlaylists}
                              accessibilityRole="button"
                              accessibilityLabel="See all playlists"
                              hitSlop={space.sm}
                            >
                              <Text style={styles.seeAll}>See all</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.railList}
                        >
                          {(playlists ?? []).map((playlist) => (
                            <Pressable
                              key={playlist.id}
                              onPress={() => onOpenPlaylist?.(playlist.id)}
                              accessibilityRole="button"
                              accessibilityLabel={`Open playlist ${playlist.name}`}
                              style={({ pressed }) => [styles.railItem, pressed && styles.rowPressed]}
                            >
                              <CoverArt
                                hue={hueFromSeed(playlist.id + playlist.name)}
                                title={playlist.name}
                                size={96}
                                radius={radius.coverLarge}
                              />
                              <Text style={styles.railLabel} numberOfLines={1}>
                                {playlist.name}
                              </Text>
                            </Pressable>
                          ))}
                          {onOpenPlaylists && (playlists?.length ?? 0) === 0 ? (
                            <Pressable
                              onPress={onOpenPlaylists}
                              accessibilityRole="button"
                              accessibilityLabel="Create a playlist"
                              style={({ pressed }) => [styles.railItem, pressed && styles.rowPressed]}
                            >
                              <View style={styles.createCard}>
                                <Ionicons name="add" size={30} color={colors.textDim} />
                              </View>
                              <Text style={styles.railLabel} numberOfLines={1}>
                                Create playlist
                              </Text>
                            </Pressable>
                          ) : null}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                ) : undefined
              }
              initialNumToRender={16}
              windowSize={9}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              {...scrollHandlers}
              contentContainerStyle={{
                paddingBottom: insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + 170,
              }}
            />
            <ScrollBar
              scrollY={scrollY}
              contentHeight={contentHeight}
              viewportHeight={viewportHeight}
              bottomOffset={bottomOffset}
              onScrollTo={(offset) => listRef.current?.scrollToOffset({ offset, animated: false })}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  brandIcon: {
    width: 26,
    height: 26,
  },
  wordmark: {
    ...type.display,
    color: colors.text,
    letterSpacing: -0.5,
  },
  scanning: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  scanningText: {
    ...type.meta,
    color: colors.textDim,
  },
  note: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  noteText: {
    ...type.meta,
    color: colors.textDim,
  },
  likedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.md,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
  likedIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.coverLarge,
    backgroundColor: colors.accent,
  },
  likedText: {
    flex: 1,
    gap: 2,
  },
  likedTitle: {
    ...type.body,
    color: colors.text,
  },
  likedMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  rails: {
    gap: space.sm,
    paddingBottom: space.md,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  railTitle: {
    ...type.body,
    color: colors.text,
  },
  seeAll: {
    ...type.meta,
    color: colors.accent2,
  },
  railList: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  railItem: {
    width: 96,
    gap: space.xs,
  },
  railLabel: {
    ...type.meta,
    color: colors.text,
  },
  createCard: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.coverLarge,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    opacity: 0.75,
  },
});
