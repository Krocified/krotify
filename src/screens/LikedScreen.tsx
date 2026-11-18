import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollectionHeader } from '../components/CollectionHeader';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { BackPill, ScreenHeader } from '../components/ScreenHeader';
import { SelectionBar } from '../components/SelectionBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useFavorites } from '../library/FavoritesProvider';
import { formatDuration } from '../lib/format';
import { hueFromSeed } from '../lib/hash';
import {
  clearSelection,
  selectionBackHandler,
  selectionState,
  toggleAllVisible,
  toggleId,
} from '../lib/selection';
import { shuffleOrder } from '../lib/shuffle';
import { colors, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks?: Track[];
  onClose: () => void;
  onPlay: (queue: Track[]) => void;
  onSelect?: (track: Track, queue: Track[]) => void;
  onNotify?: (message: string) => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
};

export function LikedScreen({
  tracks = [],
  onClose,
  onPlay,
  onSelect,
  onNotify,
  registerBackInterceptor,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ids, toggle: toggleFavorite } = useFavorites();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingRemoval, setPendingRemoval] = useState<Track | null>(null);
  const openRowRef = useRef<SwipeableMethods | null>(null);
  const favoriteTracks = useMemo(
    () => tracks.filter((track) => ids.has(track.id)),
    [ids, tracks],
  );
  const visibleIds = useMemo(
    () => favoriteTracks.map((track) => track.id),
    [favoriteTracks],
  );
  const selectedTracks = useMemo(
    () => favoriteTracks.filter((track) => selectedIds.has(track.id)),
    [favoriteTracks, selectedIds],
  );
  const selectedCount = selectedTracks.length;
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

  const closeOpenRow = useCallback(() => {
    openRowRef.current?.close();
    openRowRef.current = null;
  }, []);

  const handleRowOpen = useCallback((methods: SwipeableMethods) => {
    const current = openRowRef.current;
    if (current && current !== methods) current.close();
    openRowRef.current = methods;
  }, []);

  const handleRowClose = useCallback((methods: SwipeableMethods) => {
    if (openRowRef.current === methods) openRowRef.current = null;
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

  const play = () => {
    if (favoriteTracks.length > 0) onPlay(favoriteTracks);
  };

  const shuffle = () => {
    if (favoriteTracks.length > 0) {
      onPlay(shuffleOrder(favoriteTracks, -1, Math.random).order);
    }
  };

  function startSelection(track: Track) {
    closeOpenRow();
    setSelecting(true);
    setSelectedIds(new Set([track.id]));
  }

  function toggleSelection(track: Track) {
    setSelectedIds((previous) => toggleId(previous, track.id));
  }

  function pressTrack(track: Track) {
    if (selecting) {
      toggleSelection(track);
      return;
    }
    if (onSelect) onSelect(track, favoriteTracks);
    else onPlay(favoriteTracks);
  }

  function longPressTrack(track: Track) {
    if (selecting) toggleSelection(track);
    else startSelection(track);
  }

  async function removeSelection() {
    const targets = selectedTracks;
    if (targets.length === 0) return;
    exitSelection();
    let removed = 0;
    try {
      for (const track of targets) {
        const favorite = await toggleFavorite(track.id);
        if (!favorite) removed += 1;
      }
      onNotify?.(
        removed === 0
          ? 'Could not update Liked Songs'
          : removed === 1
            ? 'Removed 1 song from Liked Songs'
            : `Removed ${removed} songs from Liked Songs`,
      );
    } catch {
      onNotify?.('Could not update Liked Songs');
    }
  }

  function requestRemoval(track: Track) {
    closeOpenRow();
    setPendingRemoval(track);
  }

  async function confirmRemoval() {
    const track = pendingRemoval;
    setPendingRemoval(null);
    if (!track) return;
    try {
      const favorite = await toggleFavorite(track.id);
      onNotify?.(
        favorite
          ? `Could not remove "${track.title}"`
          : `Removed "${track.title}" from Liked Songs`,
      );
    } catch {
      onNotify?.('Could not update Liked Songs');
    }
  }

  return (
    <View style={styles.root} onTouchStart={closeOpenRow}>
      <ScreenHeader leading={<BackPill onPress={onClose} />} title="Liked Songs" />
      {selecting ? (
        <SelectionBar
          count={selectedCount}
          allState={selectionState(selectedIds, visibleIds)}
          onToggleAll={() => setSelectedIds((previous) => toggleAllVisible(previous, visibleIds))}
          actions={[
            {
              key: 'remove',
              label: 'Remove',
              icon: 'trash-outline',
              tone: 'destructive',
              disabled: selectedCount === 0,
              onPress: () => {
                void removeSelection();
              },
            },
          ]}
          onCancel={exitSelection}
        />
      ) : null}
      <FlatList
        data={favoriteTracks}
        keyExtractor={(track) => track.id}
        extraData={selectedIds}
        onScrollBeginDrag={closeOpenRow}
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
          <LikedTrackRow
            track={item}
            selecting={selecting}
            selected={selectedIds.has(item.id)}
            onPress={pressTrack}
            onLongPress={longPressTrack}
            onOpen={handleRowOpen}
            onClose={handleRowClose}
            onRequestRemove={requestRemoval}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom:
            insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + space.xl + 110,
        }}
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
      <ConfirmSheet
        visible={pendingRemoval !== null}
        title="Remove from Liked Songs?"
        message={
          pendingRemoval
            ? `"${pendingRemoval.title}" will be removed from Liked Songs.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          void confirmRemoval();
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </View>
  );
}

type LikedTrackRowProps = {
  track: Track;
  selecting: boolean;
  selected: boolean;
  onPress: (track: Track) => void;
  onLongPress: (track: Track) => void;
  onOpen: (methods: SwipeableMethods) => void;
  onClose: (methods: SwipeableMethods) => void;
  onRequestRemove: (track: Track) => void;
};

function LikedTrackRow({
  track,
  selecting,
  selected,
  onPress,
  onLongPress,
  onOpen,
  onClose,
  onRequestRemove,
}: LikedTrackRowProps) {
  const swipeRef = useRef<SwipeableMethods | null>(null);

  return (
    <Swipeable
      ref={swipeRef}
      enabled={!selecting}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
      childrenContainerStyle={styles.swipeContent}
      onSwipeableWillOpen={() => {
        if (swipeRef.current) onOpen(swipeRef.current);
      }}
      onSwipeableClose={() => {
        if (swipeRef.current) onClose(swipeRef.current);
      }}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onRequestRemove(track);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${track.title} from Liked Songs`}
          style={({ pressed }) => [styles.removeAction, pressed && styles.removeActionPressed]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.bg} />
          <Text style={styles.removeActionText}>Remove</Text>
        </Pressable>
      )}
    >
      <TrackRow
        track={track}
        selectionMode={selecting}
        selected={selected}
        onPress={onPress}
        onLongPress={() => onLongPress(track)}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  swipeContainer: {
    backgroundColor: colors.bg,
  },
  swipeContent: {
    backgroundColor: colors.bg,
  },
  removeAction: {
    width: 96,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: colors.danger,
  },
  removeActionPressed: {
    opacity: 0.8,
  },
  removeActionText: {
    ...type.meta,
    color: colors.bg,
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
