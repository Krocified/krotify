import { useRef } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecentlyPlayed } from '../components/RecentlyPlayed';
import { HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import { colors, space, type } from '../theme';
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
                recentTracks.length > 0 ? (
                  <RecentlyPlayed tracks={recentTracks} onSelect={onSelect} />
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
});
