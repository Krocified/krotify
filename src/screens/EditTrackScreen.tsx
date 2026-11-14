import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
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
import { importTrackCopy } from '../library/imports';
import { applyTagEdit, TagWriteError } from '../library/tagWriter';
import { validateTagPatch, type ArtworkInput, type TagFields } from '../lib/tagPatch';
import { formatDuration } from '../lib/format';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

export type EditTrackMode = 'edit' | 'rename' | 'details';

export type EditTrackScreenProps = {
  track: Track;
  onSaved: (track: Track) => void;
  onClose: () => void;
  mode?: EditTrackMode;
};

type StringKey = 'title' | 'artist' | 'album' | 'albumArtist' | 'genre';
type NumberKey = 'trackNumber' | 'discNumber' | 'year';
type FormState = Record<StringKey | NumberKey, string>;

type AccessState = 'checking' | 'granted' | 'denied' | 'unavailable';

type ArtworkSelection = {
  uri: string;
  input: ArtworkInput;
};

const STRING_FIELDS: { key: StringKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'albumArtist', label: 'Album artist' },
  { key: 'genre', label: 'Genre' },
];

const NUMBER_FIELDS: { key: NumberKey; label: string; min: number }[] = [
  { key: 'trackNumber', label: 'Track number', min: 1 },
  { key: 'discNumber', label: 'Disc number', min: 1 },
  { key: 'year', label: 'Year', min: 0 },
];

const MODE_TITLE: Record<EditTrackMode, string> = {
  edit: 'Edit track',
  rename: 'Rename track',
  details: 'Track details',
};

function initialAccess(track: Track, mode: EditTrackMode): AccessState {
  if (mode === 'details' || track.source === 'import') return 'granted';
  if (Platform.OS === 'web') return 'unavailable';
  if (track.source === 'demo' || !track.uri) return 'denied';
  return 'checking';
}

function fileSizeOf(uri: string): number | null {
  if (!uri.startsWith('file://')) return null;
  try {
    const file = new File(uri);
    return file.exists ? file.size : null;
  } catch {
    return null;
  }
}

function formFromTrack(track: Track): FormState {
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

function buildPatch(track: Track, form: FormState, renameOnly: boolean): {
  patch: Partial<TagFields>;
  error?: string;
} {
  const patch: Partial<TagFields> = {};

  for (const { key } of STRING_FIELDS) {
    if (renameOnly && key !== 'title') continue;
    const value = form[key].trim();
    if (key === 'title' && value.length === 0) {
      return { patch, error: 'Title is required.' };
    }
    const current = (track[key] ?? '').trim();
    if (value !== current) patch[key] = value;
  }

  if (!renameOnly) {
    for (const { key, label, min } of NUMBER_FIELDS) {
      const raw = form[key].trim();
      if (raw.length === 0) continue;
      const value = Number(raw);
      if (!Number.isInteger(value)) {
        return { patch, error: `${label} must be a whole number.` };
      }
      if (value < min) {
        return { patch, error: min === 0 ? `${label} cannot be negative.` : `${label} must be at least 1.` };
      }
      if (value !== track[key]) patch[key] = value;
    }
  }

  return { patch };
}

function errorMessage(error: unknown): string {
  if (error instanceof TagWriteError) {
    switch (error.code) {
      case 'NO_WRITE_ACCESS':
        return 'This file cannot be edited in place. Import a copy and edit it instead.';
      case 'UNSUPPORTED_FORMAT':
        return 'This audio format cannot be edited.';
      case 'INVALID_ARTWORK':
        return error.message;
      case 'CACHE_FAILED':
        return error.message;
      case 'FILE_NOT_FOUND':
        return 'The audio file is no longer available.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Could not save changes.';
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
  const [workingTrack, setWorkingTrack] = useState(track);
  const [form, setForm] = useState<FormState>(() => formFromTrack(track));
  const [access, setAccess] = useState<AccessState>(() => initialAccess(track, mode));
  const [artwork, setArtwork] = useState<ArtworkSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCopy, setNeedsCopy] = useState(false);
  const fileSize = mode === 'details' ? fileSizeOf(track.uri) : null;

  useEffect(() => {
    if (
      mode === 'details' ||
      Platform.OS === 'web' ||
      workingTrack.source === 'demo' ||
      workingTrack.source === 'import' ||
      !workingTrack.uri
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const native = await import('../../modules/audio-tags');
        const granted = await native.requestWriteAccess([workingTrack.uri]);
        if (!cancelled) setAccess(granted.includes(workingTrack.uri) ? 'granted' : 'denied');
      } catch {
        if (!cancelled) setAccess('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, workingTrack.source, workingTrack.uri]);

  function updateField(key: StringKey | NumberKey, value: string) {
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
      const validation = validateTagPatch({}, input);
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

  async function importCopy() {
    setBusy(true);
    setError(null);
    try {
      const copy = await importTrackCopy(workingTrack);
      if (!copy) {
        setError('No file was imported.');
        return;
      }
      setWorkingTrack(copy);
      setNeedsCopy(false);
      setAccess('granted');
    } catch {
      setError('Could not import a copy of this track.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError(null);
    const { patch, error: validationError } = buildPatch(workingTrack, form, mode === 'rename');
    if (validationError) {
      setError(validationError);
      return;
    }
    if (Object.keys(patch).length === 0 && !artwork) {
      setError('No changes to save.');
      return;
    }

    setBusy(true);
    try {
      const saved = await applyTagEdit(
        workingTrack,
        patch,
        artwork ? { artworkUri: artwork.uri, artwork: artwork.input } : undefined,
      );
      onSaved(saved);
      onClose();
    } catch (saveError) {
      if (saveError instanceof TagWriteError && saveError.code === 'NO_WRITE_ACCESS') {
        setNeedsCopy(true);
      }
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function renderBody() {
    if (access === 'checking') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.centeredText}>Checking write access…</Text>
        </View>
      );
    }

    if (access === 'denied' || access === 'unavailable') {
      const demo = workingTrack.source === 'demo';
      const canCopy = !demo && access === 'denied' && Platform.OS !== 'web';
      return (
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textDim} />
          <Text style={styles.centeredTitle}>Read-only track</Text>
          <Text style={styles.centeredText}>
            {access === 'unavailable'
              ? 'Tag editing requires the Krotify development build. It is not available in this preview.'
              : demo
                ? 'Demo tracks are read-only.'
                : 'Krotify does not have permission to edit this file in place. Import a copy and edit that instead.'}
          </Text>
          {canCopy ? (
            <Pressable
              onPress={() => void importCopy()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Import a copy and edit"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.primaryText}>Import a copy and edit</Text>
              )}
            </Pressable>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      );
    }

    if (mode === 'details') {
      return (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        >
          <View style={styles.detailHero}>
            <CoverArt
              hue={workingTrack.artworkHue}
              title={workingTrack.title}
              size={120}
              radius={radius.coverLarge}
              uri={workingTrack.artworkUri}
            />
          </View>
          <DetailRow label="Title" value={workingTrack.title || '—'} />
          <DetailRow label="Artist" value={workingTrack.artist || '—'} />
          <DetailRow label="Album" value={workingTrack.album || '—'} />
          <DetailRow label="Album artist" value={workingTrack.albumArtist || '—'} />
          <DetailRow
            label="Track / year"
            value={`${workingTrack.trackNumber ?? '—'} / ${workingTrack.year ?? '—'}`}
          />
          <DetailRow
            label="Disc"
            value={workingTrack.discNumber === undefined ? '—' : String(workingTrack.discNumber)}
          />
          <DetailRow label="Genre" value={workingTrack.genre || '—'} />
          <DetailRow label="Duration" value={formatDuration(workingTrack.durationMs)} />
          {workingTrack.uri ? <DetailRow label="Format" value={extensionOf(workingTrack.uri) || '—'} /> : null}
          {fileSize !== null ? <DetailRow label="File size" value={formatBytes(fileSize)} /> : null}
          {workingTrack.uri ? <DetailRow label="Path" value={workingTrack.uri} multiline /> : null}
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
                hue={workingTrack.artworkHue}
                title={workingTrack.title}
                size={92}
                radius={radius.coverLarge}
                uri={artwork?.uri ?? workingTrack.artworkUri}
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

          {STRING_FIELDS.filter((field) => !renameOnly || field.key === 'title').map((field) => (
            <Field
              key={field.key}
              label={field.label}
              value={form[field.key]}
              onChangeText={(value) => updateField(field.key, value)}
              autoFocus={renameOnly && field.key === 'title'}
            />
          ))}

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
          {needsCopy ? (
            <Pressable
              onPress={() => void importCopy()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Import a copy and edit"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Import a copy and edit</Text>
            </Pressable>
          ) : null}

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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  centeredTitle: {
    ...type.body,
    color: colors.text,
  },
  centeredText: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
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
