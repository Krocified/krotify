import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import {
  importFromLink,
  linkProgressLabel,
  parseYoutubeInput,
  type LinkProgress,
} from '../imports/link';
import { loadLinkServerConfig } from '../imports/serverConfig';
import type { ImportFailure } from '../imports/local';
import { colors, radius, space, type } from '../theme';
import type { TrackRecord } from '../tracks/types';

type Props = {
  active: boolean;
  importing: boolean;
  importFailures: ImportFailure[];
  onImport: () => Promise<void>;
  onLinkImported: (record: TrackRecord) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

export function ImportScreen({
  active,
  importing,
  importFailures,
  onImport,
  onLinkImported,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkProgress, setLinkProgress] = useState<LinkProgress | null>(null);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const canImport = Platform.OS !== 'web';
  const canDownload =
    canImport && !linkBusy && linkUrl.trim() !== '' && serverReady !== false;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void loadLinkServerConfig()
      .then((config) => {
        if (!cancelled) setServerReady(Boolean(config?.url));
      })
      .catch(() => {
        if (!cancelled) setServerReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  async function startImport() {
    if (!canImport || importing) return;
    setError(null);
    try {
      await onImport();
    } catch {
      setError('Could not import those files. Try again.');
    }
  }

  async function downloadLink() {
    if (!canDownload) return;
    const url = linkUrl.trim();
    setLinkNote(null);
    setLinkError(null);
    const target = parseYoutubeInput(url);
    if (!target.ok) {
      setLinkError(target.reason);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLinkBusy(true);
    try {
      const outcome = await importFromLink(url, {
        signal: controller.signal,
        onProgress: setLinkProgress,
      });
      if (outcome.ok) {
        setLinkUrl('');
        setLinkNote(null);
        setLinkError(null);
        setLinkProgress(null);
        onLinkImported(outcome.record);
      } else if (outcome.cancelled) {
        setLinkNote('Download cancelled.');
        setLinkError(null);
      } else {
        setLinkError(outcome.error);
      }
    } finally {
      abortRef.current = null;
      setLinkProgress(null);
      setLinkBusy(false);
    }
  }

  function cancelLink() {
    abortRef.current?.abort();
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        leading={<Ionicons name="download-outline" size={26} color={colors.text} />}
        title="Import"
        trailing={
          <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 32,
        }}
      >
        <View style={styles.content}>
          <Pressable
            onPress={() => void startImport()}
            disabled={!canImport || importing}
            accessibilityRole="button"
            accessibilityLabel="Import audio files"
            accessibilityState={{ disabled: !canImport || importing, busy: importing }}
            style={({ pressed }) => [
              styles.localCard,
              (!canImport || importing) && styles.cardDisabled,
              pressed && canImport && !importing && styles.cardPressed,
            ]}
          >
            {importing ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={34} color={colors.accent2} />
            )}
            <Text style={styles.cardTitle}>Import audio files</Text>
            <Text style={styles.localMeta}>
              {canImport
                ? importing
                  ? 'Importing files…'
                  : 'Tap to copy audio files into the app'
                : 'Available on device builds'}
            </Text>
            <Text style={styles.formats}>
              MP3 · M4A/AAC · FLAC · OGG/Opus · WAV · WebM
            </Text>
          </Pressable>

          {error ? (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {importFailures.length > 0 ? (
            <View style={styles.failure}>
              <Pressable
                onPress={() => setFailuresOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={
                  failuresOpen ? 'Hide import errors' : 'Show import errors'
                }
                accessibilityState={{ expanded: failuresOpen }}
                style={({ pressed }) => [
                  styles.failureHeader,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.failureHeaderText}>
                  <Text style={styles.failureText}>
                    {importFailures.length} file
                    {importFailures.length === 1 ? '' : 's'} could not be imported
                  </Text>
                  <Text style={styles.failureMeta}>
                    {failuresOpen ? 'Tap to collapse' : 'Tap to see the full error'}
                  </Text>
                </View>
                <Ionicons
                  name={failuresOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textDim}
                />
              </Pressable>
              {failuresOpen
                ? importFailures.map((failure, index) => (
                    <View
                      key={`${failure.name}-${index}`}
                      style={styles.failureItem}
                    >
                      <Text style={styles.failureName} numberOfLines={1}>
                        {failure.name}
                      </Text>
                      <Text style={styles.failureReason} selectable>
                        {failure.reason}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          ) : null}

          <View style={[styles.card, styles.linkCard, !canImport && styles.cardDisabled]}>
            <View style={styles.linkHeader}>
              <Text style={styles.cardTitle}>From a link</Text>
              {canImport ? null : (
                <Text style={styles.cardMeta}>Available on device builds</Text>
              )}
            </View>
            {serverReady === false ? (
              <Pressable
                onPress={onOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="Open Settings to set the link service URL"
                style={({ pressed }) => [styles.serverNote, pressed && styles.cardPressed]}
              >
                <Ionicons name="link-outline" size={18} color={colors.accent2} />
                <Text style={styles.serverNoteText}>
                  Set the link service URL in Settings to download from a link.
                </Text>
              </Pressable>
            ) : null}
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!linkBusy && canImport}
              accessibilityLabel="YouTube link"
              style={[styles.linkInput, !canImport && styles.controlDisabled]}
            />
            {linkNote ? <Text style={styles.linkNote}>{linkNote}</Text> : null}
            {linkError ? <Text style={styles.linkError}>{linkError}</Text> : null}
            {linkProgress ? (
              <Text style={styles.linkNote}>{linkProgressLabel(linkProgress)}</Text>
            ) : null}
            <View style={styles.linkActions}>
              <Pressable
                onPress={() => void downloadLink()}
                disabled={!canDownload}
                accessibilityRole="button"
                accessibilityLabel="Download from link"
                accessibilityState={{ disabled: !canDownload, busy: linkBusy }}
                style={({ pressed }) => [
                  styles.linkButton,
                  styles.linkButtonPrimary,
                  !canDownload && styles.controlDisabled,
                  pressed && canDownload && styles.controlPressed,
                ]}
              >
                <Text style={styles.linkButtonText}>Download</Text>
              </Pressable>
              {linkBusy ? (
                <Pressable
                  onPress={cancelLink}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel download"
                  style={({ pressed }) => [
                    styles.linkButton,
                    pressed && styles.controlPressed,
                  ]}
                >
                  <Text style={styles.linkButtonText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: space.md,
    paddingTop: space.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
  localCard: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.screen,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  localMeta: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
  formats: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space.xs,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardPressed: {
    backgroundColor: colors.surfaceHi,
  },
  linkCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: space.sm,
  },
  linkHeader: {
    gap: space.xs,
  },
  linkInput: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  serverNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  serverNoteText: {
    ...type.meta,
    flex: 1,
    color: colors.accent2,
  },
  linkNote: {
    ...type.meta,
    color: colors.textDim,
  },
  linkError: {
    ...type.meta,
    color: colors.danger,
  },
  linkActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  linkButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  linkButtonPrimary: {
    backgroundColor: colors.accent,
  },
  linkButtonText: {
    ...type.body,
    color: colors.text,
  },
  controlDisabled: {
    opacity: 0.55,
  },
  controlPressed: {
    opacity: 0.75,
  },
  cardTitle: {
    ...type.body,
    color: colors.text,
  },
  cardMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  error: {
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: '#3A1518',
  },
  errorText: {
    ...type.meta,
    color: '#FF8A8A',
  },
  failure: {
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: '#3A2E15',
    gap: space.xs,
  },
  failureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  failureHeaderText: {
    flex: 1,
    gap: space.xs,
  },
  failureText: {
    ...type.meta,
    color: '#FFD08A',
  },
  failureMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  failureItem: {
    gap: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff14',
  },
  failureName: {
    ...type.meta,
    color: colors.text,
  },
  failureReason: {
    ...type.meta,
    color: colors.textDim,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  emptyTitle: {
    ...type.body,
    color: colors.text,
  },
  emptyMeta: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
});
