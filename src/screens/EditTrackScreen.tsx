import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Directory, File, Paths } from 'expo-file-system';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { BackPill, ScreenHeader } from '../components/ScreenHeader';
import { validateArtworkInput, type ArtworkInput } from '../lib/artworkInput';
import { formatDuration } from '../lib/format';
import { buildTrackFieldPatch, type EditForm } from '../tracks/editPatch';
import { updateTrackFields } from '../tracks/repo';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

export type EditTrackMode = 'edit' | 'rename' | 'details';

export type EditTrackScreenProps = {
  track: Track;
  onSaved: (track: Track) => void;
  onClose: () => void;
  mode?: EditTrackMode;
};

type ArtworkSelection = {
  uri: string;
  input: ArtworkInput;
};

const STRING_FIELDS: { key: keyof EditForm; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'albumArtist', label: 'Album artist' },
  { key: 'genre', label: 'Genre' },
];

const NUMBER_FIELDS: { key: keyof EditForm; label: string }[] = [
  { key: 'trackNumber', label: 'Track number' },
  { key: 'discNumber', label: 'Disc number' },
  { key: 'year', label: 'Year' },
];

const MODE_TITLE: Record<EditTrackMode, string> = {
  edit: 'Edit track',
  rename: 'Rename track',
  details: 'Track details',
};

function fileSizeOf(uri: string): number | null {
  if (!uri.startsWith('file://')) return null;
  try {
    const file = new File(uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

function formFromTrack(track: Track): EditForm {
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist ?? '',
    genre: track.genre ?? '',
    trackNumber: track.trackNumber === undefined ? '' : String(track.trackNumber),
    discNumber: track.discNumber === undefined ? '' : String(track.discNumber),
    year: track.year === undefined ? '' : String(track.year),
  };
}

function extensionOf(uri: string): string {
  const clean = uri.split('?')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toUpperCase() : '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function artworkMime(file: File): string {
  if (file.type.startsWith('image/')) return file.type;
  const extension = extensionOf(file.name).toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function persistArtwork(file: File): Promise<string> {
  const directory = new Directory(Paths.document, 'artwork');
  directory.create({ intermediates: true, idempotent: true });
  const extension = extensionOf(file.name) || 'jpg';
  const destination = new File(directory, `edit-${Date.now()}.${extension.toLowerCase()}`);
  await file.copy(destination);
  return destination.uri;
}

export function EditTrackScreen({ track, onSaved, onClose, mode = 'edit' }: EditTrackScreenProps) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<EditForm>(() => formFromTrack(track));
  const [artwork, setArtwork] = useState<ArtworkSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileSize = mode === 'details' ? fileSizeOf(track.uri) : null;

  function updateField(key: keyof EditForm, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError(null);
  }

  async function chooseArtwork() {
    setError(null);
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['image/*'] });
      if (picked.canceled) return;
      const file = picked.result;
      const input: ArtworkInput = { mimeType: artworkMime(file), sizeBytes: file.size };
      const validation = validateArtworkInput(input);
      if (!validation.ok) {
        setError(validation.errors.join(' '));
        return;
      }
      const uri = await persistArtwork(file);
      setArtwork({ uri, input });
    } catch {
      setError('Could not open the artwork picker.');
    }
  }

  async function save() {
    setError(null);
    const { patch, error: validationError } = buildTrackFieldPatch(
      track,
      form,
      mode === 'rename',
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextPatch = artwork ? { ...patch, artworkUri: artwork.uri } : patch;
    if (Object.keys(nextPatch).length === 0) {
      setError('No changes to save.');
      return;
    }

    setBusy(true);
    try {
      await updateTrackFields(track.id, nextPatch);
      onSaved({ ...track, ...nextPatch });
      onClose();
    } catch {
      setError('Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  function renderBody() {
    if (mode === 'details') {
      return (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        >
          <View style={styles.detailHero}>
            <CoverArt
              hue={track.artworkHue}
              title={track.title}
              size={120}
              radius={radius.coverLarge}
              uri={track.artworkUri}
            />
          </View>
          <DetailRow label="Title" value={track.title || '—'} />
          <DetailRow label="Artist" value={track.artist || '—'} />
          <DetailRow label="Album" value={track.album || '—'} />
          <DetailRow label="Album artist" value={track.albumArtist || '—'} />
          <DetailRow
            label="Track / year"
            value={`${track.trackNumber ?? '—'} / ${track.year ?? '—'}`}
          />
          <DetailRow
            label="Disc"
            value={track.discNumber === undefined ? '—' : String(track.discNumber)}
          />
          <DetailRow label="Genre" value={track.genre || '—'} />
          <DetailRow label="Duration" value={formatDuration(track.durationMs)} />
          {track.uri ? <DetailRow label="Format" value={extensionOf(track.uri) || '—'} /> : null}
          {fileSize !== null ? <DetailRow label="File size" value={formatBytes(fileSize)} /> : null}
          {track.uri ? <DetailRow label="Path" value={track.uri} multiline /> : null}
        </ScrollView>
      );
    }

    const renameOnly = mode === 'rename';
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        >
          {!renameOnly ? (
            <View style={styles.artworkRow}>
              <CoverArt
                hue={track.artworkHue}
                title={track.title}
                size={92}
                radius={radius.coverLarge}
                uri={artwork?.uri ?? track.artworkUri}
              />
              <View style={styles.artworkActions}>
                <Pressable
                  onPress={() => void chooseArtwork()}
                  accessibilityRole="button"
                  accessibilityLabel="Choose artwork"
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                  <Ionicons name="image-outline" size={18} color={colors.text} />
                  <Text style={styles.secondaryText}>Choose artwork</Text>
                </Pressable>
                {artwork ? (
                  <Pressable
                    onPress={() => setArtwork(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove selected artwork"
                    style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                  >
                    <Text style={styles.linkText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {STRING_FIELDS.filter((field) => !renameOnly || field.key === 'title').map(
            (field) => (
              <Field
                key={field.key}
                label={field.label}
                value={form[field.key]}
                onChangeText={(value) => updateField(field.key, value)}
                autoFocus={renameOnly && field.key === 'title'}
              />
            ),
          )}

          {!renameOnly
            ? NUMBER_FIELDS.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  value={form[field.key]}
                  onChangeText={(value) => updateField(field.key, value)}
                  keyboardType="number-pad"
                />
              ))
            : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.secondary, styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: busy, busy }}
              style={({ pressed }) => [styles.primary, styles.action, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.primaryText}>Save</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader leading={<BackPill onPress={onClose} />} title={MODE_TITLE[mode]} />
      {renderBody()}
    </View>
  );
}

export function TrackDetailsScreen(props: Omit<EditTrackScreenProps, 'mode'>) {
  return <EditTrackScreen {...props} mode="details" />;
}

export function RenameTrackScreen(props: Omit<EditTrackScreenProps, 'mode'>) {
  return <EditTrackScreen {...props} mode="rename" />;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad';
  autoFocus?: boolean;
};

function Field({ label, value, onChangeText, keyboardType = 'default', autoFocus }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
        style={styles.input}
      />
    </View>
  );
}

function DetailRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={multiline ? 3 : 1}>
        {value}
      </Text>
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
  artworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  artworkActions: {
    flex: 1,
    gap: space.sm,
    alignItems: 'flex-start',
  },
  field: {
    gap: space.xs,
  },
  fieldLabel: {
    ...type.meta,
    color: colors.textDim,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    minHeight: 48,
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
  },
  linkText: {
    ...type.meta,
    color: colors.accent2,
  },
  pressed: {
    opacity: 0.75,
  },
  error: {
    ...type.meta,
    color: '#FF6B6B',
  },
  detailHero: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  detailLabel: {
    ...type.meta,
    color: colors.textDim,
  },
  detailValue: {
    ...type.meta,
    flex: 1,
    color: colors.text,
    textAlign: 'right',
  },
});
