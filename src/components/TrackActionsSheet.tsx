import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addPlaylistTrack,
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
  onClose: () => void;
  onDetails?: (track: Track) => void;
  onEdit?: (track: Track) => void;
  onRename?: (track: Track) => void;
  onExclude?: (track: Track) => void;
  onDelete?: (track: Track) => void;
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
  onClose,
  onDetails,
  onEdit,
  onRename,
  onExclude,
  onDelete,
  onFavorite,
  onAddToPlaylist,
}: Props) {
  const actions: Action[] = [];
  if (onDetails) actions.push({ key: 'details', label: 'Details', icon: 'information-circle-outline', onPress: onDetails });
  if (onEdit) actions.push({ key: 'edit', label: 'Edit metadata', icon: 'create-outline', onPress: onEdit });
  if (onRename) actions.push({ key: 'rename', label: 'Rename', icon: 'pencil', onPress: onRename });
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
      label: 'Add to playlist',
      icon: 'add-circle-outline',
      onPress: onAddToPlaylist,
    });
  }
  if (onExclude) actions.push({ key: 'exclude', label: 'Exclude from library', icon: 'eye-off-outline', onPress: onExclude });
  if (onDelete) actions.push({ key: 'delete', label: 'Delete from device', icon: 'trash-outline', tone: 'destructive', onPress: onDelete });

  const choose = (action: Action) => {
    if (!track) return;
    onClose();
    action.onPress(track);
  };

  return (
    <Sheet visible={track !== null} title={track?.title} onClose={onClose}>
      <View style={styles.list}>
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

export function PlaylistPickerSheet({ visible, track, onClose, onAdded }: PickerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

  function closePicker() {
    setMessage(null);
    onClose();
  }

  async function addTo(playlist: Playlist) {
    if (!track || busyId) return;
    setBusyId(playlist.id);
    setMessage(null);
    try {
      const existing = await listPlaylistTracks(playlist.id);
      if (existing.includes(track.id)) {
        setMessage(`"${track.title}" is already in ${playlist.name}.`);
        return;
      }
      await addPlaylistTrack(playlist.id, track.id);
      setMessage(`Added to ${playlist.name}.`);
      onAdded?.(playlist);
    } catch {
      setMessage('Could not add this track.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet visible={visible} title="Add to playlist" onClose={closePicker}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : playlists.length === 0 ? (
        <Text style={styles.empty}>No playlists yet. Create one from the Library playlists rail.</Text>
      ) : (
        playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            onPress={() => void addTo(playlist)}
            disabled={busyId !== null}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${playlist.name}`}
            accessibilityState={{ disabled: busyId !== null, busy: busyId === playlist.id }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
            <Text style={styles.label} numberOfLines={1}>
              {playlist.name}
            </Text>
            {busyId === playlist.id ? <ActivityIndicator color={colors.accent} /> : null}
          </Pressable>
        ))
      )}
      {message ? <Text style={styles.message}>{message}</Text> : null}
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
});
