import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { updatePlaylistDetails, type Playlist, type PlaylistDetailsPatch } from '../db/repo';
import {
  commitPlaylistCover,
  deletePlaylistCoverFile,
  discardStagedCover,
  stagePlaylistCoverFrom,
} from '../library/playlistArtwork';
import { playlistArtwork } from '../lib/playlistView';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';
import { Sheet } from './Sheet';
import { SquareImageCropper } from './SquareImageCropper';

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
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [stagedUri, setStagedUri] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededId = useRef<string | null>(null);
  const stagedRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      const uri = stagedRef.current;
      stagedRef.current = null;
      if (uri) void discardStagedCover(uri);
    };
  }, []);

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
    setCoverRemoved(false);
    stagedRef.current = null;
    setStagedUri(null);
    setCropUri(null);
    setPicking(false);
    setBusy(false);
    setError(null);
  }, [playlist, visible]);

  if (!playlist) return null;

  const previewName = name.trim() || playlist.name;
  const artwork = playlistArtwork(
    {
      ...playlist,
      artworkUri: coverRemoved ? undefined : coverUri ?? undefined,
    },
    tracks,
  );

  function handleClose() {
    if (busy) return;
    const uri = stagedRef.current;
    stagedRef.current = null;
    setStagedUri(null);
    setCropUri(null);
    if (uri) void discardStagedCover(uri);
    onClose();
  }

  async function chooseCover() {
    if (!playlist || picking || busy) return;
    setPicking(true);
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) return;
      setCropUri(asset.uri);
    } catch {
      setError('Could not open the cover picker.');
    } finally {
      setPicking(false);
    }
  }

  async function handleCropDone(file: File) {
    if (!playlist) return;
    setCropUri(null);
    setPicking(true);
    setError(null);
    try {
      const uri = await stagePlaylistCoverFrom(playlist.id, {
        uri: file.uri,
        name: file.name,
      });
      try {
        new File(file.uri).delete();
      } catch {}
      if (!mountedRef.current) {
        if (uri) void discardStagedCover(uri);
        return;
      }
      if (!uri) {
        setError('Could not use that image.');
        return;
      }
      const previous = stagedRef.current;
      stagedRef.current = uri;
      setStagedUri(uri);
      setCoverUri(uri);
      setCoverRemoved(false);
      if (previous) void discardStagedCover(previous);
    } catch {
      setError('Could not use that image.');
    } finally {
      setPicking(false);
    }
  }

  function removeCover() {
    if (picking || busy) return;
    const previous = stagedRef.current;
    stagedRef.current = null;
    setStagedUri(null);
    setCoverUri(null);
    setCoverRemoved(true);
    setError(null);
    if (previous) void discardStagedCover(previous);
  }

  async function save() {
    if (!playlist || busy) return;
    const nextName = name.trim();
    if (!nextName) {
      setError('Playlist name cannot be empty.');
      return;
    }
    const nextDescription = description.trim();
    const patch: PlaylistDetailsPatch = {
      name: nextName,
      description: nextDescription,
    };
    let nextArtworkUri = playlist.artworkUri;
    setBusy(true);
    setError(null);
    try {
      if (stagedUri) {
        const committedUri = await commitPlaylistCover(playlist.id, stagedUri);
        patch.artworkUri = committedUri;
        nextArtworkUri = committedUri;
      } else if (coverRemoved) {
        patch.artworkUri = null;
        nextArtworkUri = undefined;
      }
      await updatePlaylistDetails(playlist.id, patch);
      if (coverRemoved) await deletePlaylistCoverFile(playlist.id);
      if (stagedUri) {
        stagedRef.current = null;
        setStagedUri(null);
        void discardStagedCover(stagedUri);
      }
      onSaved({
        ...playlist,
        name: nextName,
        description: nextDescription || undefined,
        artworkUri: nextArtworkUri,
      });
      onClose();
    } catch {
      setError('Could not save the playlist.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet visible={visible} title="Edit playlist" onClose={handleClose}>
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
            disabled={picking || busy}
            accessibilityRole="button"
            accessibilityLabel="Choose cover"
            accessibilityState={{ disabled: picking || busy, busy: picking }}
            style={({ pressed }) => [
              styles.secondary,
              (picking || busy) && styles.disabled,
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
              onPress={removeCover}
              disabled={picking || busy}
              accessibilityRole="button"
              accessibilityLabel="Remove cover"
              accessibilityState={{ disabled: picking || busy }}
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
          onPress={handleClose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [
            styles.secondary,
            styles.action,
            busy && styles.disabled,
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
      <SquareImageCropper
        visible={cropUri !== null}
        uri={cropUri}
        onCancel={() => setCropUri(null)}
        onDone={(file) => void handleCropDone(file)}
      />
    </>
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
    color: colors.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
