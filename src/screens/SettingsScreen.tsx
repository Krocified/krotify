import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appJson from '../../app.json';
import { CreatedByKrocified } from '../components/CreatedByKrocified';
import { BackPill } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { SleepTimerControls } from '../components/SleepTimerControls';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { useScrollProgress } from '../components/useScrollProgress';
import {
  moveFilesLabel,
  reclaimableLabel,
  type StorageView,
} from '../lib/settingsView';
import { loadLinkServerConfig, saveLinkServerConfig } from '../imports/serverConfig';
import { LINK_IMPORT_ENABLED } from '../lib/features';
import type { SleepPreset } from '../lib/sleepTimer';
import { usePlayer } from '../player/PlayerProvider';
import { colors, radius, space, type } from '../theme';

type Props = {
  visible: boolean;
  storage: StorageView | null;
  storageBusy: boolean;
  onBack: () => void;
  onChangeFolder: () => void;
  onMoveFiles: () => void;
  moveFailures?: { name: string; reason: string }[];
  onCleanStorage: () => void;
  onOpenTags: () => void;
  onOpenTechStack?: () => void;
  onOpenLibrarySettings: () => void;
};

const RELEASE_ABI = 'arm64-v8a';

export function SettingsScreen({
  visible,
  storage,
  storageBusy,
  onBack,
  onChangeFolder,
  onMoveFiles,
  moveFailures = [],
  onCleanStorage,
  onOpenTags,
  onOpenTechStack,
  onOpenLibrarySettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { sleep, setSleep } = usePlayer();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkToken, setLinkToken] = useState('');
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const noFilesToMove = storage !== null && storage.fileCount === 0;
  const nothingToClean = storage !== null && storage.reclaimableBytes === 0;
  const bottomPad = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + 66 + insets.bottom + space.xl;

  useEffect(() => {
    if (!visible || !LINK_IMPORT_ENABLED) return;
    let cancelled = false;
    void loadLinkServerConfig()
      .then((config) => {
        if (cancelled) return;
        setLinkUrl(config?.url ?? '');
        setLinkToken(config?.token ?? '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function saveLinkConfig() {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkNote(null);
    setLinkError(null);
    try {
      await saveLinkServerConfig({ url: linkUrl.trim(), token: linkToken.trim() });
      setLinkNote('Saved.');
    } catch {
      setLinkError('Could not save the link service settings.');
    } finally {
      setLinkBusy(false);
    }
  }

  const selectSleepPreset = useCallback(
    (preset: SleepPreset) => {
      if (preset === 'end') setSleep('end');
      else setSleep('timer', preset);
    },
    [setSleep],
  );

  return (
    <View
      style={[styles.root, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={styles.title}>Settings</Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          {...scrollHandlers}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          <Text style={styles.sectionTitle}>Library</Text>
          <View style={styles.card}>
            <Pressable
              onPress={onOpenLibrarySettings}
              accessibilityRole="button"
              accessibilityLabel="Library settings"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Library settings</Text>
                <Text style={styles.rowMeta}>Permission, scanning, hidden tracks</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            </Pressable>
          </View>

          {moveFailures.length > 0 ? (
            <View style={styles.moveFailures}>
              <Text style={styles.moveFailuresTitle}>Move failed</Text>
              {moveFailures.map((item) => (
                <Text key={`${item.name}-${item.reason}`} style={styles.moveFailuresText}>
                  {item.name}: {item.reason}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.card}>
            <Pressable
              onPress={onOpenTags}
              accessibilityRole="button"
              accessibilityLabel="Manage tags"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Manage tags</Text>
                <Text style={styles.rowMeta}>Create and delete tags</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.card}>
            <View style={styles.row} accessible accessibilityLabel="Current storage folder">
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Current folder</Text>
                <Text style={styles.rowMeta}>Where imported files are stored</Text>
              </View>
              <Text style={styles.rowValue}>
                {storage === null ? 'Loading storage...' : storage.folderName}
              </Text>
            </View>

            <Pressable
              onPress={onChangeFolder}
              disabled={storageBusy}
              accessibilityRole="button"
              accessibilityLabel="Change folder"
              accessibilityState={{ disabled: storageBusy }}
              style={({ pressed }) => [
                styles.row,
                storageBusy && styles.rowDisabled,
                pressed && !storageBusy && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Change folder</Text>
                <Text style={styles.rowMeta}>Choose a new folder for imported files</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            </Pressable>

            <Pressable
              onPress={onMoveFiles}
              disabled={storageBusy || noFilesToMove}
              accessibilityRole="button"
              accessibilityLabel="Move existing files"
              accessibilityState={{ disabled: storageBusy || noFilesToMove }}
              style={({ pressed }) => [
                styles.row,
                (storageBusy || noFilesToMove) && styles.rowDisabled,
                pressed && !storageBusy && !noFilesToMove && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Move existing files</Text>
                <Text style={styles.rowMeta}>
                  {noFilesToMove
                    ? 'No files to move.'
                    : storage === null
                      ? 'Loading storage...'
                      : moveFilesLabel(storage.fileCount, storage.totalBytes)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            </Pressable>

            <Pressable
              onPress={onCleanStorage}
              disabled={storageBusy || nothingToClean}
              accessibilityRole="button"
              accessibilityLabel="Clean reclaimable space"
              accessibilityState={{ disabled: storageBusy || nothingToClean }}
              style={({ pressed }) => [
                styles.row,
                (storageBusy || nothingToClean) && styles.rowDisabled,
                pressed && !storageBusy && !nothingToClean && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Reclaimable space</Text>
                <Text style={styles.rowMeta}>
                  {nothingToClean
                    ? 'Nothing to clean.'
                    : storage === null
                      ? 'Loading storage...'
                      : reclaimableLabel(storage.reclaimableBytes)}
                </Text>
              </View>
              <Text style={styles.actionText}>Clean</Text>
            </Pressable>

            {LINK_IMPORT_ENABLED ? (
              <View style={styles.linkFields}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Link service URL</Text>
                  <TextInput
                    value={linkUrl}
                    onChangeText={(value) => {
                      setLinkUrl(value);
                      setLinkNote(null);
                      setLinkError(null);
                    }}
                    placeholder="https://links.example.com"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    accessibilityLabel="Link service URL"
                    style={styles.input}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Link service token</Text>
                  <TextInput
                    value={linkToken}
                    onChangeText={(value) => {
                      setLinkToken(value);
                      setLinkNote(null);
                      setLinkError(null);
                    }}
                    placeholder="Optional access token"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    accessibilityLabel="Link service token"
                    style={styles.input}
                  />
                </View>
                <Pressable
                  onPress={() => void saveLinkConfig()}
                  disabled={linkBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Save link service settings"
                  accessibilityState={{ disabled: linkBusy, busy: linkBusy }}
                  style={({ pressed }) => [
                    styles.saveButton,
                    linkBusy && styles.rowDisabled,
                    pressed && !linkBusy && styles.actionPressed,
                  ]}
                >
                  {linkBusy ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </Pressable>
                {linkNote ? <Text style={styles.saveNote}>{linkNote}</Text> : null}
                {linkError ? <Text style={styles.saveError}>{linkError}</Text> : null}
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Playback</Text>
          <View style={styles.card}>
            <View style={styles.stackRow}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Sleep timer</Text>
                <Text style={styles.rowMeta}>Fade out and stop playback after the timer</Text>
              </View>
              <SleepTimerControls
                mode={sleep.mode}
                remainingMs={sleep.remainingMs}
                onSelect={selectSleepPreset}
                onCancel={() => setSleep('off')}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Pressable
              onPress={onOpenTechStack}
              accessibilityRole="button"
              accessibilityLabel={`Krotify ${appJson.expo.version}, view tech stack`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Krotify {appJson.expo.version}</Text>
                <Text style={styles.rowMeta}>Local playback.</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            </Pressable>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Release ABI</Text>
              <Text style={styles.rowValue}>{RELEASE_ABI}</Text>
            </View>
            <CreatedByKrocified />
          </View>
        </Animated.ScrollView>
        <ScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bottomOffset={TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
  },
  hidden: {
    display: 'none',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  content: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  sectionTitle: {
    ...type.meta,
    color: colors.textDim,
    marginTop: space.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.md,
  },
  stackRow: {
    gap: space.md,
    padding: space.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceHi,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  rowValue: {
    ...type.meta,
    color: colors.textDim,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...type.meta,
    color: colors.accent2,
  },
  flex: {
    flex: 1,
  },
  linkFields: {
    gap: space.sm,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff10',
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
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  saveButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  saveButtonText: {
    ...type.body,
    color: colors.text,
  },
  saveNote: {
    ...type.meta,
    color: colors.accent2,
  },
  moveFailures: {
    backgroundColor: '#2A1418',
    borderRadius: radius.screen,
    padding: space.md,
    gap: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FF6B6B66',
  },
  moveFailuresTitle: {
    ...type.meta,
    color: colors.danger,
    fontWeight: '700',
  },
  moveFailuresText: {
    ...type.meta,
    color: colors.textDim,
  },
  saveError: {
    ...type.meta,
    color: colors.danger,
  },
});
