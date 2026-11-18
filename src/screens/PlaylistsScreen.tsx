import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';
import { CollectionHeader } from '../components/CollectionHeader';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { CoverArt } from '../components/CoverArt';
import { PlaylistActionsSheet } from '../components/PlaylistActionsSheet';
import { PlaylistCard } from '../components/PlaylistCard';
import { PlaylistCreateSheet } from '../components/PlaylistCreateSheet';
import { PlaylistEditSheet } from '../components/PlaylistEditSheet';
import { BackPill, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import {
  addPlaylistTracks,
  deletePlaylist,
  listPlaylistSummaries,
  listPlaylistTracks,
  removePlaylistTrack,
  reorderPlaylistTracks,
  type Playlist,
  type PlaylistSummary,
} from '../db/repo';
import { PlaylistSongPicker } from './PlaylistSongPicker';
import { bulkAddMessage } from '../lib/playlistAdd';
import type { TagCount } from '../tags/filter';
import { formatDuration } from '../lib/format';
import { hueFromSeed } from '../lib/hash';
import { moveId } from '../lib/playlistOrder';
import { deletePlaylistCoverFile } from '../library/playlistArtwork';
import { playlistArtwork } from '../lib/playlistView';
import { shuffleOrder } from '../lib/shuffle';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks?: Track[];
  onClose: () => void;
  onPlay: (queue: Track[]) => void;
  onSelect?: (track: Track, queue: Track[]) => void;
  playlistId?: string | null;
  onOpenPlaylist?: (id: string | null) => void;
  onPlaylistsChanged?: () => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
  tags?: TagCount[];
  assignments?: ReadonlyMap<string, readonly string[]>;
};

function applyVisibleOrder(current: string[], visibleOrder: string[]): string[] {
  const visible = new Set(visibleOrder);
  let cursor = 0;
  return current.map((id) => (visible.has(id) ? visibleOrder[cursor++] : id));
}

export function PlaylistsScreen({
  tracks = [],
  onClose,
  onPlay,
  onSelect,
  playlistId,
  onOpenPlaylist,
  onPlaylistsChanged,
  registerBackInterceptor,
  tags = [],
  assignments = new Map(),
}: Props) {
  const insets = useSafeAreaInsets();
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionsTarget, setActionsTarget] = useState<Playlist | null>(null);
  const [editTarget, setEditTarget] = useState<{
    playlist: Playlist;
    queue: Track[];
  } | null>(null);
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Playlist | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  const reorderQueue = useRef<Promise<void>>(Promise.resolve());
  const reorderSeq = useRef(0);

  const selectedId = playlistId === undefined ? localSelectedId : playlistId;
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedId) ?? null;
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const queue = useMemo(
    () =>
      trackIds
        .map((id) => byId.get(id))
        .filter((track): track is Track => track !== undefined),
    [byId, trackIds],
  );

  useEffect(() => {
    let cancelled = false;
    listPlaylistSummaries()
      .then((items) => {
        if (!cancelled) setPlaylists(items);
      })
      .catch(() => {
        if (!cancelled) setMessage('Could not load playlists.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function refreshSummaries() {
    listPlaylistSummaries()
      .then((items) => setPlaylists(items))
      .catch(() => {});
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    listPlaylistTracks(selectedId)
      .then((ids) => {
        if (!cancelled) setTrackIds(ids);
      })
      .catch(() => {
        if (!cancelled) setMessage('Could not load this playlist.');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function openPlaylist(id: string) {
    setMessage(null);
    setTrackIds([]);
    if (onOpenPlaylist) onOpenPlaylist(id);
    else setLocalSelectedId(id);
  }

  function closeDetail() {
    setMessage(null);
    if (onOpenPlaylist) onOpenPlaylist(null);
    else setLocalSelectedId(null);
    refreshSummaries();
  }

  function handleCreated(playlist: Playlist) {
    setPlaylists((previous) => [{ ...playlist, trackCount: 0 }, ...previous]);
    setCreateOpen(false);
    setMessage(null);
    onPlaylistsChanged?.();
  }

  function startEdit(playlist: Playlist, queueTracks?: Track[]) {
    setMessage(null);
    if (queueTracks) {
      setEditTarget({ playlist, queue: queueTracks });
      return;
    }
    listPlaylistTracks(playlist.id)
      .then((ids) => {
        const items = ids
          .map((id) => byId.get(id))
          .filter((track): track is Track => track !== undefined);
        setEditTarget({ playlist, queue: items });
      })
      .catch(() => setMessage('Could not load this playlist.'));
  }

  function handleSaved(saved: Playlist) {
    setPlaylists((previous) =>
      previous.map((playlist) =>
        playlist.id === saved.id ? { ...playlist, ...saved } : playlist,
      ),
    );
    setEditTarget((current) =>
      current && current.playlist.id === saved.id
        ? { ...current, playlist: saved }
        : current,
    );
    refreshSummaries();
    onPlaylistsChanged?.();
  }

  async function confirmDelete() {
    const playlist = pendingDelete;
    if (!playlist) return;
    setPendingDelete(null);
    try {
      await deletePlaylist(playlist.id);
      await deletePlaylistCoverFile(playlist.id);
      setPlaylists((previous) => previous.filter((item) => item.id !== playlist.id));
      if (selectedId === playlist.id) closeDetail();
    } catch {
      setMessage('Could not delete the playlist.');
    }
  }

  async function remove(trackId: string) {
    if (!selectedId || busyTrackId) return;
    setBusyTrackId(trackId);
    try {
      await removePlaylistTrack(selectedId, trackId);
      setTrackIds((previous) => previous.filter((id) => id !== trackId));
      setPlaylists((previous) =>
        previous.map((playlist) =>
          playlist.id === selectedId
            ? { ...playlist, trackCount: Math.max(0, playlist.trackCount - 1) }
            : playlist,
        ),
      );
    } catch {
      setMessage('Could not remove the track.');
    } finally {
      setBusyTrackId(null);
    }
  }

  async function addSongs(ids: string[]) {
    if (!selectedId || ids.length === 0) return;
    const added = await addPlaylistTracks(selectedId, ids);
    setTrackIds((previous) => [...previous, ...ids.filter((id) => !previous.includes(id))]);
    setMessage(bulkAddMessage(added, 1, []));
    setPickerOpen(false);
    refreshSummaries();
    onPlaylistsChanged?.();
  }

  useEffect(() => {
    if (!registerBackInterceptor) return;
    if (!pickerOpen) {
      registerBackInterceptor(null);
      return;
    }
    registerBackInterceptor(() => {
      setPickerOpen(false);
      return true;
    });
    return () => registerBackInterceptor(null);
  }, [registerBackInterceptor, pickerOpen]);

  function persistOrder(ids: string[]) {
    if (!selectedId) return;
    const playlistId = selectedId;
    const seq = (reorderSeq.current += 1);
    // Serialize writes so rapid drops cannot open overlapping transactions.
    reorderQueue.current = reorderQueue.current
      .then(() => reorderPlaylistTracks(playlistId, ids))
      .then(() => {
        if (seq !== reorderSeq.current || selectedIdRef.current !== playlistId) return;
        setMessage((current) =>
          current === 'Could not reorder the playlist.' ? null : current,
        );
        const firstArtworkUri = ids
          .map((id) => byId.get(id))
          .find((track) => Boolean(track?.artworkUri))?.artworkUri;
        setPlaylists((previous) =>
          previous.map((playlist) =>
            playlist.id === playlistId ? { ...playlist, firstArtworkUri } : playlist,
          ),
        );
      })
      .catch(async () => {
        if (seq !== reorderSeq.current || selectedIdRef.current !== playlistId) return;
        setMessage('Could not reorder the playlist.');
        try {
          const stored = await listPlaylistTracks(playlistId);
          if (selectedIdRef.current === playlistId) setTrackIds(stored);
        } catch {}
      });
  }

  function applyOrder(visibleIds: string[]) {
    const next = applyVisibleOrder(trackIds, visibleIds);
    const changed =
      next.length !== trackIds.length ||
      next.some((id, index) => id !== trackIds[index]);
    if (!changed) return;
    setTrackIds(next);
    persistOrder(next);
  }

  function moveTrack(trackId: string, direction: -1 | 1) {
    const visible = queue.map((track) => track.id);
    const from = visible.indexOf(trackId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= visible.length) return;
    applyOrder(moveId(visible, from, to));
  }

  function renderIndex() {
    return (
      <View style={styles.flex}>
        <ScreenHeader leading={<BackPill onPress={onClose} />} title="Playlists" />
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(playlist) => playlist.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom:
                  insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + space.xl + 110,
              },
            ]}
            ListHeaderComponent={
              <View style={styles.indexHeader}>
                <Pressable
                  onPress={() => setCreateOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="New playlist"
                  style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={22} color={colors.text} />
                  <Text style={styles.newButtonText}>New playlist</Text>
                </Pressable>
                {message ? <Text style={styles.message}>{message}</Text> : null}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="musical-notes-outline" size={34} color={colors.textDim} />
                <Text style={styles.emptyText}>
                  No playlists yet. Create one above to collect tracks.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <PlaylistCard
                summary={item}
                onOpen={() => openPlaylist(item.id)}
                onMenu={() => setActionsTarget(item)}
              />
            )}
          />
        )}
      </View>
    );
  }

  function renderDetail() {
    const name = selectedPlaylist?.name ?? 'Playlist';
    const missing = trackIds.length - queue.length;
    const totalMs = queue.reduce((sum, track) => sum + (track.durationMs || 0), 0);
    const meta = `${queue.length} ${queue.length === 1 ? 'song' : 'songs'} · ${formatDuration(totalMs)}`;
    const artwork = selectedPlaylist
      ? playlistArtwork(selectedPlaylist, queue)
      : { hue: hueFromSeed(name) };

    function playAll() {
      if (queue.length > 0) onPlay(queue);
    }

    function shuffleAll() {
      if (queue.length > 0) onPlay(shuffleOrder(queue, -1, Math.random).order);
    }

    return (
      <View style={styles.flex}>
        <ScreenHeader
          leading={<BackPill onPress={closeDetail} label="Back to playlists" />}
          title={name}
        />
        <Animated.ScrollView
          ref={scrollableRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom:
              insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + space.xl + 110,
          }}
        >
          <View style={styles.detailTop}>
            <CollectionHeader
              title={name}
              description={selectedPlaylist?.description}
              meta={meta}
              artworkUri={artwork.uri}
              fallbackHue={artwork.hue}
              onPlay={playAll}
              onShuffle={shuffleAll}
              onEdit={
                selectedPlaylist
                  ? () => startEdit(selectedPlaylist, queue)
                  : undefined
              }
              disabled={queue.length === 0}
            />
            <View style={styles.detailActions}>
              <Pressable
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Add songs to ${name}`}
                style={({ pressed }) => [styles.addSongs, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.addSongsText}>Add songs</Text>
              </Pressable>
            </View>
            {message ? (
              <Text style={[styles.message, styles.detailMessage]}>{message}</Text>
            ) : null}
            {missing > 0 ? (
              <Text style={[styles.message, styles.detailMessage]}>
                {missing} {missing === 1 ? 'song is' : 'songs are'} no longer available.
              </Text>
            ) : null}
          </View>
          {queue.length === 0 ? (
            <View style={styles.detailEmpty}>
              <Ionicons name="musical-notes-outline" size={34} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No songs yet</Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Add songs to ${name}`}
                style={({ pressed }) => [styles.addSongs, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.addSongsText}>Add songs</Text>
              </Pressable>
            </View>
          ) : (
            <Sortable.Grid
              columns={1}
              rowGap={0}
              data={queue}
              keyExtractor={(track) => track.id}
              dragActivationDelay={300}
              customHandle
              scrollableRef={scrollableRef}
              onDragEnd={({ data }) => applyOrder(data.map((track) => track.id))}
              renderItem={({ item, index }) => (
                <PlaylistTrackRow
                  track={item}
                  busy={busyTrackId === item.id}
                  canMoveUp={index > 0}
                  canMoveDown={index < queue.length - 1}
                  onPlay={() => (onSelect ? onSelect(item, queue) : onPlay(queue))}
                  onRemove={() => void remove(item.id)}
                  onMove={(direction) => moveTrack(item.id, direction)}
                />
              )}
            />
          )}
        </Animated.ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {selectedId ? renderDetail() : renderIndex()}
      <ConfirmSheet
        visible={pendingDelete !== null}
        title="Delete playlist?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed. Its tracks stay in your library.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
      <PlaylistEditSheet
        visible={editTarget !== null}
        playlist={editTarget?.playlist ?? null}
        tracks={editTarget?.queue}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
      />
      <PlaylistActionsSheet
        visible={actionsTarget !== null}
        playlist={actionsTarget}
        onClose={() => setActionsTarget(null)}
        onEdit={() => {
          const target = actionsTarget;
          setActionsTarget(null);
          if (target) startEdit(target);
        }}
        onDelete={() => {
          const target = actionsTarget;
          setActionsTarget(null);
          if (target) setPendingDelete(target);
        }}
      />
      <PlaylistCreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      {pickerOpen && selectedId ? (
        <PlaylistSongPicker
          playlistName={selectedPlaylist?.name ?? 'Playlist'}
          tracks={tracks}
          existingIds={trackIds}
          tags={tags}
          assignments={assignments}
          onClose={() => setPickerOpen(false)}
          onAdd={addSongs}
        />
      ) : null}
    </View>
  );
}

type RowProps = {
  track: Track;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
};

function PlaylistTrackRow({
  track,
  busy,
  canMoveUp,
  canMoveDown,
  onPlay,
  onRemove,
  onMove,
}: RowProps) {
  const accessibilityActions = [
    ...(canMoveUp ? [{ name: 'increment' as const, label: 'Move up' }] : []),
    ...(canMoveDown ? [{ name: 'decrement' as const, label: 'Move down' }] : []),
  ];
  return (
    <View style={styles.trackRow}>
      <Pressable
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title}`}
        accessibilityActions={accessibilityActions.length > 0 ? accessibilityActions : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onMove(-1);
          else if (event.nativeEvent.actionName === 'decrement') onMove(1);
        }}
        style={({ pressed }) => [styles.trackMain, pressed && styles.trackPressed]}
      >
        <CoverArt
          hue={track.artworkHue}
          title={track.title}
          size={48}
          radius={4}
          uri={track.artworkUri}
        />
        <View style={styles.trackText}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {track.title}
          </Text>
          {track.artist ? (
            <Text style={styles.trackMeta} numberOfLines={1}>
              {track.artist}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Text style={styles.duration}>{formatDuration(track.durationMs)}</Text>
      <Sortable.Handle style={styles.handle}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Ionicons name="reorder-three-outline" size={22} color={colors.textDim} />
        </View>
      </Sortable.Handle>
      <View style={styles.removeSlot}>
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${track.title} from playlist`}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.textDim} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.md,
  },
  gridRow: {
    gap: space.md,
  },
  indexHeader: {
    gap: space.sm,
  },
  newButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    ...type.body,
    color: colors.text,
  },
  message: {
    ...type.meta,
    color: colors.accent2,
  },
  loading: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  detailActions: {
    flexDirection: 'row',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  addSongs: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: 999,
    backgroundColor: colors.surfaceHi,
  },
  addSongsText: {
    ...type.meta,
    color: colors.text,
  },
  empty: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
  },
  detailEmpty: {
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
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: {
    opacity: 0.75,
  },
  detailTop: {
    paddingBottom: space.sm,
    gap: space.sm,
  },
  detailMessage: {
    paddingHorizontal: space.md,
  },
  trackRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  trackMain: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  trackPressed: {
    opacity: 0.75,
  },
  trackText: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    ...type.body,
    color: colors.text,
  },
  trackMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  duration: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
    marginLeft: space.sm,
  },
  handle: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
