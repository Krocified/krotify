import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { useFavorites } from '../library/FavoritesProvider';
import { SelectionBar } from '../components/SelectionBar';
import { TagBulkSheet } from '../components/TagBulkSheet';
import { PlaylistPickerSheet } from '../components/TrackActionsSheet';
import {
  clearSelection,
  selectionBackHandler,
  selectionState,
  toggleAllVisible,
  toggleId,
} from '../lib/selection';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TagFilterBar } from '../components/TagFilterBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import type { TagCount } from '../tags/filter';
import { colors, space, type } from '../theme';
import type { LibraryStatus, Track } from '../types';

type Props = {
  tracks: Track[];
  tags: TagCount[];
  selectedTagId: string | null;
  onSelectTag: (id: string | null) => void;
  status: LibraryStatus;
  statusNote: string | null;
  onSelect: (track: Track, queue: Track[]) => void;
  onManage: (track: Track) => void;
  onHideMany: (tracks: Track[]) => void;
  onDeleteMany: (tracks: Track[]) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenLiked?: () => void;
  onOpenPlaylists?: () => void;
  onPlaylistsChanged?: () => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
  onNotify?: (message: string) => void;
};

const STATUS_NOTE: Partial<Record<LibraryStatus, string>> = {
  denied: 'Showing demo tracks. Allow audio access in Settings.',
  empty: 'No audio files found. Showing demo tracks.',
  error: 'Could not read your library. Showing demo tracks.',
};

export function LibraryScreen({
  tracks,
  tags,
  selectedTagId,
  onSelectTag,
  status,
  statusNote,
  onSelect,
  onManage,
  onHideMany,
  onDeleteMany,
  onOpenSearch,
  onOpenSettings,
  onPlaylistsChanged,
  registerBackInterceptor,
  onNotify,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const listRef = useRef<FlatList<Track>>(null);
  const statusMessage = STATUS_NOTE[status] ?? null;
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8;
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tagOpen, setTagOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const selectedTracks = useMemo(
    () => tracks.filter((track) => selectedIds.has(track.id)),
    [tracks, selectedIds],
  );
  const visibleIds = useMemo(() => tracks.map((track) => track.id), [tracks]);
  const selectedCount = selectedTracks.length;
  const allSelectedLiked =
    selectedCount > 0 && selectedTracks.every((track) => favoriteIds.has(track.id));

  const likeSelection = useCallback(async () => {
    if (selectedCount === 0) return;
    const targets = selectedTracks.filter((track) =>
      allSelectedLiked ? favoriteIds.has(track.id) : !favoriteIds.has(track.id),
    );
    try {
      for (const track of targets) await toggleFavorite(track.id);
      onNotify?.(
        allSelectedLiked
          ? `Removed ${targets.length} from Liked Songs`
          : `Added ${targets.length} to Liked Songs`,
      );
    } catch {
      onNotify?.('Could not update Liked Songs');
    }
  }, [allSelectedLiked, favoriteIds, onNotify, selectedCount, selectedTracks, toggleFavorite]);

  const startSelection = useCallback((track: Track) => {
    setSelecting(true);
    setSelectedIds(new Set([track.id]));
  }, []);

  const toggleSelection = useCallback((track: Track) => {
    setSelectedIds((previous) => toggleId(previous, track.id));
  }, []);

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelectedIds(clearSelection());
  }, []);

  useEffect(() => {
    if (!registerBackInterceptor) return;
    registerBackInterceptor(selectionBackHandler(selecting, exitSelection));
    return () => registerBackInterceptor(null);
  }, [exitSelection, registerBackInterceptor, selecting]);

  const pressTrack = useCallback(
    (track: Track) => {
      if (selecting) toggleSelection(track);
      else onSelect(track, tracks);
    },
    [onSelect, selecting, toggleSelection, tracks],
  );

  const longPressTrack = useCallback(
    (track: Track) => {
      if (selecting) toggleSelection(track);
      else startSelection(track);
    },
    [selecting, startSelection, toggleSelection],
  );

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <TrackRow
        track={item}
        selectionMode={selecting}
        selected={selectedIds.has(item.id)}
        onPress={pressTrack}
        onLongPress={longPressTrack}
        onMore={selecting ? undefined : onManage}
      />
    ),
    [longPressTrack, onManage, pressTrack, selectedIds, selecting],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        leading={
          <>
            <Image
              source={require('../../assets/krotifyclose.png')}
              style={styles.brandIcon}
              accessible={false}
            />
            <Text style={styles.wordmark}>Krotify</Text>
          </>
        }
        trailing={<HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />}
      />

      {selecting ? (
        <SelectionBar
          count={selectedCount}
          allState={selectionState(selectedIds, visibleIds)}
          onToggleAll={() => setSelectedIds((previous) => toggleAllVisible(previous, visibleIds))}
          actions={[
            {
              key: 'like',
              label: allSelectedLiked ? 'Unlike' : 'Like',
              icon: allSelectedLiked ? 'heart' : 'heart-outline',
              iconOnly: true,
              disabled: selectedCount === 0,
              onPress: () => {
                void likeSelection();
              },
            },
            {
              key: 'tag',
              label: 'Tag',
              icon: 'pricetags-outline',
              iconOnly: true,
              disabled: selectedCount === 0,
              onPress: () => setTagOpen(true),
            },
            {
              key: 'playlist',
              label: 'Playlist',
              icon: 'bookmark-outline',
              iconOnly: true,
              disabled: selectedCount === 0,
              onPress: () => setPlaylistOpen(true),
            },
            {
              key: 'hide',
              label: 'Hide',
              icon: 'eye-off-outline',
              iconOnly: true,
              disabled: selectedCount === 0,
              onPress: () => {
                const targets = selectedTracks;
                exitSelection();
                onHideMany(targets);
              },
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: 'trash-outline',
              tone: 'destructive',
              iconOnly: true,
              disabled: selectedCount === 0,
              onPress: () => {
                const targets = selectedTracks;
                exitSelection();
                onDeleteMany(targets);
              },
            },
          ]}
          onCancel={exitSelection}
        />
      ) : null}

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
              renderItem={renderItem}
              extraData={selectedIds}
              ListHeaderComponent={
                selecting ? undefined : (
                  <TagFilterBar tags={tags} selectedId={selectedTagId} onSelect={onSelectTag} />
                )
              }
              ListEmptyComponent={
                selectedTagId !== null && tracks.length === 0 ? (
                  <View style={styles.filterEmpty}>
                    <Text style={styles.filterEmptyText}>No tracks with this tag.</Text>
                    <Pressable
                      onPress={() => onSelectTag(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Show all tracks"
                      style={({ pressed }) => [
                        styles.filterEmptyButton,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Text style={styles.filterEmptyButtonText}>Show all</Text>
                    </Pressable>
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
      <TagBulkSheet
        visible={tagOpen}
        trackIds={[...selectedIds]}
        onClose={() => setTagOpen(false)}
        onDone={(message) => onNotify?.(message)}
      />
      <PlaylistPickerSheet
        visible={playlistOpen}
        tracks={selectedTracks}
        onClose={() => {
          setPlaylistOpen(false);
          exitSelection();
        }}
        onResult={(message) => {
          onNotify?.(message);
          onPlaylistsChanged?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
  filterEmpty: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xl,
  },
  filterEmptyText: {
    ...type.meta,
    color: colors.textDim,
  },
  filterEmptyButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceHi,
  },
  filterEmptyButtonText: {
    ...type.meta,
    color: colors.text,
  },
  rowPressed: {
    opacity: 0.75,
  },
});
