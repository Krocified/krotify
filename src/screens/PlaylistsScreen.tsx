import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollectionHeader } from '../components/CollectionHeader';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { CoverArt } from '../components/CoverArt';
import { BackPill, ScreenHeader } from '../components/ScreenHeader';
import {
  createPlaylist,
  deletePlaylist,
  listPlaylistTracks,
  listPlaylists,
  removePlaylistTrack,
  renamePlaylist,
  type Playlist,
} from '../db/repo';
import { formatDuration } from '../lib/format';
import { hueFromSeed } from '../lib/hash';
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
};

export function PlaylistsScreen({
  tracks = [],
  onClose,
  onPlay,
  onSelect,
  playlistId,
  onOpenPlaylist,
}: Props) {
  const insets = useSafeAreaInsets();
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Playlist | null>(null);

  const selectedId = playlistId === undefined ? localSelectedId : playlistId;
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedId) ?? null;

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
    listPlaylists()
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
  }

  async function create() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const playlist = await createPlaylist(name);
      setPlaylists((previous) => [playlist, ...previous]);
      setNewName('');
    } catch {
      setMessage('Could not create the playlist.');
    } finally {
      setBusy(false);
    }
  }

  function startRename(playlist: Playlist) {
    setRenamingId(playlist.id);
    setRenameValue(playlist.name);
    setMessage(null);
  }

  async function commitRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (!name) {
      setMessage('Playlist name cannot be empty.');
      return;
    }
    try {
      await renamePlaylist(renamingId, name);
      setPlaylists((previous) =>
        previous.map((playlist) =>
          playlist.id === renamingId ? { ...playlist, name } : playlist,
        ),
      );
      setRenamingId(null);
    } catch {
      setMessage('Could not rename the playlist.');
    }
  }

  async function confirmDelete() {
    const playlist = pendingDelete;
    if (!playlist) return;
    setPendingDelete(null);
    try {
      await deletePlaylist(playlist.id);
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
    } catch {
      setMessage('Could not remove the track.');
    } finally {
      setBusyTrackId(null);
    }
  }

  function renderIndex() {
    return (
      <View style={styles.flex}>
        <ScreenHeader leading={<BackPill onPress={onClose} />} title="Playlists" />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        >
          <View style={styles.createRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="New playlist"
              placeholderTextColor={colors.textDim}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => void create()}
            />
            <Pressable
              onPress={() => void create()}
              disabled={busy || newName.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Create playlist"
              accessibilityState={{ disabled: busy || newName.trim().length === 0 }}
              style={({ pressed }) => [
                styles.addButton,
                (busy || newName.trim().length === 0) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Ionicons name="add" size={24} color={colors.text} />
              )}
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : playlists.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={34} color={colors.textDim} />
              <Text style={styles.emptyText}>No playlists yet. Create one above to collect tracks.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {playlists.map((playlist) => (
                <View key={playlist.id} style={styles.playlistRow}>
                  {renamingId === playlist.id ? (
                    <>
                      <TextInput
                        value={renameValue}
                        onChangeText={setRenameValue}
                        autoFocus
                        placeholder="Playlist name"
                        placeholderTextColor={colors.textDim}
                        style={[styles.input, styles.renameInput]}
                        onSubmitEditing={() => void commitRename()}
                      />
                      <Pressable
                        onPress={() => void commitRename()}
                        accessibilityRole="button"
                        accessibilityLabel="Save playlist name"
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                      >
                        <Ionicons name="checkmark" size={22} color={colors.accent2} />
                      </Pressable>
                      <Pressable
                        onPress={() => setRenamingId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel rename"
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                      >
                        <Ionicons name="close" size={22} color={colors.textDim} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => openPlaylist(playlist.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${playlist.name}`}
                        style={({ pressed }) => [styles.playlistMain, pressed && styles.pressed]}
                      >
                        <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
                        <Text style={styles.playlistName} numberOfLines={1}>
                          {playlist.name}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                      </Pressable>
                      <Pressable
                        onPress={() => startRename(playlist)}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${playlist.name}`}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                      >
                        <Ionicons name="pencil" size={19} color={colors.textDim} />
                      </Pressable>
                      <Pressable
                        onPress={() => setPendingDelete(playlist)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${playlist.name}`}
                        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                      </Pressable>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
        <FlatList
          data={queue}
          keyExtractor={(track) => track.id}
          ListHeaderComponent={
            <View style={styles.detailTop}>
              <CollectionHeader
                title={name}
                description={selectedPlaylist?.description}
                meta={meta}
                artworkUri={artwork.uri}
                fallbackHue={artwork.hue}
                onPlay={playAll}
                onShuffle={shuffleAll}
                disabled={queue.length === 0}
              />
              {message ? (
                <Text style={[styles.message, styles.detailMessage]}>{message}</Text>
              ) : null}
              {missing > 0 ? (
                <Text style={[styles.message, styles.detailMessage]}>
                  {missing} {missing === 1 ? 'song is' : 'songs are'} no longer available.
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <PlaylistTrackRow
              track={item}
              busy={busyTrackId === item.id}
              onPlay={() => (onSelect ? onSelect(item, queue) : onPlay(queue))}
              onRemove={() => void remove(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
          ListEmptyComponent={
            <View style={styles.detailEmpty}>
              <Ionicons name="musical-notes-outline" size={34} color={colors.textDim} />
              <Text style={styles.emptyTitle}>No songs yet</Text>
              <Text style={styles.emptyText}>
                {"Add tracks from a song's action sheet to build this playlist."}
              </Text>
            </View>
          }
        />
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
    </View>
  );
}

type RowProps = {
  track: Track;
  busy: boolean;
  onPlay: () => void;
  onRemove: () => void;
};

function PlaylistTrackRow({ track, busy, onPlay, onRemove }: RowProps) {
  return (
    <View style={styles.trackRow}>
      <Pressable
        onPress={onPlay}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title}`}
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
  createRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  addButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  message: {
    ...type.meta,
    color: colors.accent2,
  },
  loading: {
    paddingVertical: space.xl,
    alignItems: 'center',
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingRight: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  playlistMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  playlistName: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  renameInput: {
    marginLeft: space.md,
    marginVertical: space.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  disabled: {
    opacity: 0.35,
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
    marginHorizontal: space.sm,
  },
  removeSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
