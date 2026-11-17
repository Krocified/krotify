import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addPlaylistTrack,
  createPlaylist,
  deletePlaylist,
  listPlaylistTracks,
  listPlaylists,
  type Playlist,
} from '../db/repo';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';
import { Sheet } from './Sheet';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  track: Track | null;
  favorite?: boolean;
  missing?: boolean;
  onClose: () => void;
  onDetails?: (track: Track) => void;
  onTags?: (track: Track) => void;
  onExclude?: (track: Track) => void;
  onDelete?: (track: Track) => void;
  onClear?: (track: Track) => void;
  onDeleteFile?: (track: Track) => void;
  onFavorite?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
};

type Action = {
  key: string;
  label: string;
  icon: IconName;
  tone?: 'destructive' | 'accent';
  onPress: (track: Track) => void;
};

export function TrackActionsSheet({
  track,
  favorite = false,
  missing = false,
  onClose,
  onDetails,
  onTags,
  onExclude,
  onDelete,
  onClear,
  onDeleteFile,
  onFavorite,
  onAddToPlaylist,
}: Props) {
  const actions: Action[] = [];
  if (missing) {
    if (onClear) {
      actions.push({
        key: 'clear',
        label: 'Delete from library',
        icon: 'remove-circle-outline',
        tone: 'destructive',
        onPress: onClear,
      });
    }
    if (onDeleteFile) {
      actions.push({
        key: 'delete-file',
        label: 'Delete file',
        icon: 'trash-outline',
        tone: 'destructive',
        onPress: onDeleteFile,
      });
    }
  } else {
    if (onDetails) actions.push({ key: 'details', label: 'Details', icon: 'information-circle-outline', onPress: onDetails });
    if (onTags) actions.push({ key: 'tags', label: 'Tags', icon: 'pricetags-outline', onPress: onTags });
    if (onFavorite) {
      actions.push({
        key: 'favorite',
        label: favorite ? 'Remove from Liked Songs' : 'Add to Liked Songs',
        icon: favorite ? 'heart' : 'heart-outline',
        tone: 'accent',
        onPress: onFavorite,
      });
    }
    if (onAddToPlaylist) {
      actions.push({
        key: 'playlist',
        label: 'Save to playlist',
        icon: 'bookmark-outline',
        onPress: onAddToPlaylist,
      });
    }
    if (onExclude) actions.push({ key: 'exclude', label: 'Exclude from library', icon: 'eye-off-outline', onPress: onExclude });
    if (onDelete) actions.push({ key: 'delete', label: 'Delete from device', icon: 'trash-outline', tone: 'destructive', onPress: onDelete });
  }

  const choose = (action: Action) => {
    if (!track) return;
    onClose();
    action.onPress(track);
  };

  return (
    <Sheet visible={track !== null} title={track?.title} onClose={onClose}>
      <View style={styles.list}>
        {missing ? (
          <View style={styles.warning} accessible accessibilityLabel="File missing">
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={styles.warningText}>File missing</Text>
          </View>
        ) : null}
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => choose(action)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons
              name={action.icon}
              size={22}
              color={
                action.tone === 'destructive'
                  ? '#FF6B6B'
                  : action.tone === 'accent'
                    ? colors.accent2
                    : colors.text
              }
            />
            <Text style={[styles.label, action.tone === 'destructive' && styles.destructive]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [styles.row, styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

type PickerProps = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onAdded?: (playlist: Playlist) => void;
};

function resultMessage(added: string[], already: string[], failed: string[]): string {
  let message = '';
  if (added.length > 0) {
    message = `Added to ${added.length} ${added.length === 1 ? 'playlist' : 'playlists'}`;
    if (already.length > 0) message += `; already in ${already.join(', ')}`;
  } else if (already.length > 0) {
    message = `Already in ${already.join(', ')}`;
  } else {
    message = 'Could not add this track';
  }
  if (failed.length > 0) message += `; failed: ${failed.join(', ')}`;
  return `${message}.`;
}

export function PlaylistPickerSheet({ visible, track, onClose, onAdded }: PickerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = creating || adding;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listPlaylists()
      .then((items) => {
        if (cancelled) return;
        setPlaylists(items);
        setSelected(new Set());
        setNewName('');
        setMessage(null);
        setLoading(false);
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
  }, [visible]);

  function closePicker() {
    setLoading(true);
    setSelected(new Set());
    setNewName('');
    setMessage(null);
    onClose();
  }

  function toggle(playlistId: string) {
    if (busy) return;
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
    setMessage(null);
  }

  async function createAndAdd() {
    if (!track || busy) return;
    const name = newName.replace(/\s+/g, ' ').trim();
    if (name === '') {
      setMessage('Enter a playlist name.');
      return;
    }
    setCreating(true);
    setMessage(null);
    let created: Playlist | null = null;
    try {
      created = await createPlaylist(name);
      await addPlaylistTrack(created.id, track.id);
      setPlaylists((previous) => [created as Playlist, ...previous]);
      setSelected((previous) => new Set(previous).add(created!.id));
      setNewName('');
      setMessage(`Created "${name}" and added "${track.title}".`);
      onAdded?.(created);
    } catch {
      if (created) {
        try {
          await deletePlaylist(created.id);
        } catch {
          // The empty playlist is harmless; report the add failure either way.
        }
      }
      setMessage('Could not create the playlist. Try again.');
    } finally {
      setCreating(false);
    }
  }

  async function addSelected() {
    if (!track || busy || selected.size === 0) return;
    setAdding(true);
    setMessage(null);
    const added: string[] = [];
    const already: string[] = [];
    const failed: string[] = [];
    for (const playlist of playlists) {
      if (!selected.has(playlist.id)) continue;
      try {
        const existing = await listPlaylistTracks(playlist.id);
        if (existing.includes(track.id)) {
          already.push(playlist.name);
          continue;
        }
        await addPlaylistTrack(playlist.id, track.id);
        added.push(playlist.name);
        onAdded?.(playlist);
      } catch {
        failed.push(playlist.name);
      }
    }
    setMessage(resultMessage(added, already, failed));
    setAdding(false);
  }

  const addLabel =
    selected.size === 0
      ? 'Add to playlists'
      : `Add to ${selected.size} ${selected.size === 1 ? 'playlist' : 'playlists'}`;

  return (
    <Sheet visible={visible} title="Add to playlist" onClose={closePicker}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : playlists.length === 0 ? (
        <Text style={styles.empty}>No playlists yet. Create one below.</Text>
      ) : (
        playlists.map((playlist) => {
          const checked = selected.has(playlist.id);
          return (
            <Pressable
              key={playlist.id}
              onPress={() => toggle(playlist.id)}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityLabel={`Add to ${playlist.name}`}
              accessibilityState={{ checked, disabled: busy }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? colors.accent : colors.textDim}
              />
              <Text style={styles.label} numberOfLines={1}>
                {playlist.name}
              </Text>
            </Pressable>
          );
        })
      )}
      {!loading ? (
      <View style={styles.newRow}>
        <TextInput
          value={newName}
          onChangeText={(value) => {
            setNewName(value);
            setMessage(null);
          }}
          onSubmitEditing={() => void createAndAdd()}
          placeholder="New playlist"
          placeholderTextColor={colors.textDim}
          editable={!busy}
          returnKeyType="done"
          maxLength={60}
          accessibilityLabel="New playlist name"
          style={styles.input}
        />
        <Pressable
          onPress={() => void createAndAdd()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Create playlist and add track"
          accessibilityState={{ disabled: busy, busy: creating }}
          style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
        >
          {creating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.createText}>Create</Text>
          )}
        </Pressable>
      </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable
        onPress={() => void addSelected()}
        disabled={selected.size === 0 || busy}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: selected.size === 0 || busy, busy: adding }}
        style={({ pressed }) => [
          styles.addButton,
          (selected.size === 0 || busy) && styles.addDisabled,
          pressed && selected.size > 0 && !busy && styles.pressed,
        ]}
      >
        {adding ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.addText}>{addLabel}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={closePicker}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={({ pressed }) => [styles.row, styles.cancel, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Done</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.xs,
  },
  warning: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
  },
  warningText: {
    ...type.body,
    color: colors.danger,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.screen,
  },
  pressed: {
    backgroundColor: colors.surfaceHi,
  },
  label: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  destructive: {
    color: '#FF6B6B',
  },
  cancel: {
    justifyContent: 'center',
    marginTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff12',
    borderRadius: 0,
  },
  cancelText: {
    ...type.body,
    color: colors.textDim,
  },
  loading: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    paddingVertical: space.md,
  },
  message: {
    ...type.meta,
    color: colors.accent2,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  newRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: 999,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  createButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 999,
    backgroundColor: colors.surfaceHi,
  },
  createText: {
    ...type.meta,
    color: colors.text,
  },
  addButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  addDisabled: {
    opacity: 0.4,
  },
  addText: {
    ...type.body,
    color: colors.text,
  },
});
