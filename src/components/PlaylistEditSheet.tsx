import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { updatePlaylistDetails, type Playlist } from '../db/repo';
import { pickPlaylistCover, removePlaylistCover } from '../library/playlistArtwork';
import { playlistArtwork } from '../lib/playlistView';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  playlist: Playlist | null;
  tracks?: Track[];
  onClose: () => void;
  onSaved: (playlist: Playlist) => void;
};

export function PlaylistEditSheet({
  visible,
  playlist,
  tracks = [],
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededId = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      seededId.current = null;
      return;
    }
    if (!playlist || seededId.current === playlist.id) return;
    seededId.current = playlist.id;
    setName(playlist.name);
    setDescription(playlist.description ?? '');
    setCoverUri(playlist.artworkUri ?? null);
    setPicking(false);
    setBusy(false);
    setError(null);
  }, [playlist, visible]);

  if (!playlist) return null;

  const previewName = name.trim() || playlist.name;
  const artwork = playlistArtwork(
    { ...playlist, artworkUri: coverUri ?? undefined },
    tracks,
  );

  async function chooseCover() {
    if (!playlist || picking) return;
    setPicking(true);
    setError(null);
    try {
      const uri = await pickPlaylistCover(playlist.id);
      if (uri) {
        setCoverUri(uri);
        onSaved({ ...playlist, artworkUri: uri });
      }
    } catch {
      setError('Could not open the cover picker.');
    } finally {
      setPicking(false);
    }
  }

  async function removeCover() {
    if (!playlist || picking) return;
    setPicking(true);
    setError(null);
    try {
      await removePlaylistCover(playlist);
      setCoverUri(null);
      onSaved({ ...playlist, artworkUri: undefined });
    } catch {
      setError('Could not remove the cover.');
    } finally {
      setPicking(false);
    }
  }

  async function save() {
    if (!playlist || busy) return;
    const nextName = name.trim();
    if (!nextName) {
      setError('Playlist name cannot be empty.');
      return;
    }
    const nextDescription = description.trim();
    setBusy(true);
    setError(null);
    try {
      await updatePlaylistDetails(playlist.id, {
        name: nextName,
        description: nextDescription,
        artworkUri: coverUri,
      });
      onSaved({
        ...playlist,
        name: nextName,
        description: nextDescription || undefined,
        artworkUri: coverUri ?? undefined,
      });
      onClose();
    } catch {
      setError('Could not save the playlist.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Edit playlist" onClose={onClose}>
      <View style={styles.coverRow}>
        <CoverArt
          hue={artwork.hue}
          title={previewName}
          size={92}
          radius={radius.coverLarge}
          uri={artwork.uri}
        />
        <View style={styles.coverActions}>
          <Pressable
            onPress={() => void chooseCover()}
            disabled={picking}
            accessibilityRole="button"
            accessibilityLabel="Choose cover"
            accessibilityState={{ disabled: picking, busy: picking }}
            style={({ pressed }) => [
              styles.secondary,
              picking && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {picking ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name="image-outline" size={18} color={colors.text} />
            )}
            <Text style={styles.secondaryText}>Choose cover</Text>
          </Pressable>
          {coverUri !== null ? (
            <Pressable
              onPress={() => void removeCover()}
              disabled={picking}
              accessibilityRole="button"
              accessibilityLabel="Remove cover"
              accessibilityState={{ disabled: picking }}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          placeholder="Playlist name"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          returnKeyType="done"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={280}
          multiline
          placeholder="What is this playlist for?"
          placeholderTextColor={colors.textDim}
          textAlignVertical="top"
          style={[styles.input, styles.descriptionInput]}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onClose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [
            styles.secondary,
            styles.action,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={busy || name.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: busy || name.trim().length === 0, busy }}
          style={({ pressed }) => [
            styles.primary,
            styles.action,
            (busy || name.trim().length === 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>Save</Text>
          )}
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  coverActions: {
    flex: 1,
    alignItems: 'flex-start',
    gap: space.sm,
  },
  field: {
    gap: space.xs,
  },
  label: {
    ...type.meta,
    color: colors.textDim,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  descriptionInput: {
    minHeight: 96,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  action: {
    flex: 1,
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  primaryText: {
    ...type.body,
    color: colors.text,
  },
  secondary: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  secondaryText: {
    ...type.body,
    color: colors.text,
  },
  link: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  linkText: {
    ...type.meta,
    color: colors.accent2,
  },
  error: {
    ...type.meta,
    color: '#FF6B6B',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
