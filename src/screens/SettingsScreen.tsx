import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appJson from '../../app.json';
import { BackPill } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { SleepTimerControls } from '../components/SleepTimerControls';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { useScrollProgress } from '../components/useScrollProgress';
import type { ScanSummary } from '../db/settings';
import {
  excludeAllMeta,
  hiddenTracksLabel,
  moveFilesLabel,
  permissionLabel,
  reclaimableLabel,
  scanResultLabel,
  type PermissionState,
  type StorageView,
} from '../lib/settingsView';
import { loadLinkServerConfig, saveLinkServerConfig } from '../imports/serverConfig';
import type { SleepPreset } from '../lib/sleepTimer';
import { usePlayer } from '../player/PlayerProvider';
import { colors, radius, space, type } from '../theme';
import type { LibraryStatus } from '../types';

type Props = {
  visible: boolean;
  status: LibraryStatus;
  scanEnabled: boolean;
  permission: PermissionState | null;
  scanSummary: ScanSummary | null;
  hiddenCount: number;
  scanExcludeCount: number;
  storage: StorageView | null;
  storageBusy: boolean;
  onBack: () => void;
  onToggleScan: (enabled: boolean) => void;
  onGrant: () => void;
  onRescan: () => void;
  onOpenHiddenTracks: () => void;
  onExcludeAll: () => void;
  onChangeFolder: () => void;
  onMoveFiles: () => void;
  onCleanStorage: () => void;
};

const RELEASE_ABI = 'arm64-v8a';

function scanSummaryLabel(summary: ScanSummary): string {
  const result = scanResultLabel(summary.found, summary.newTracks, summary.missing);
  return `${result} · ${new Date(summary.lastScanAt).toLocaleString()}`;
}

export function SettingsScreen({
  visible,
  status,
  scanEnabled,
  permission,
  scanSummary,
  hiddenCount,
  scanExcludeCount,
  storage,
  storageBusy,
  onBack,
  onToggleScan,
  onGrant,
  onRescan,
  onOpenHiddenTracks,
  onExcludeAll,
  onChangeFolder,
  onMoveFiles,
  onCleanStorage,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { sleep, setSleep } = usePlayer();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkToken, setLinkToken] = useState('');
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const scanning = status === 'scanning';
  const canRescan = scanEnabled && !scanning;
  const permissionText = permission === null ? 'Checking' : permissionLabel(permission);
  const rescanMeta =
    scanSummary === null ? 'No scan yet' : scanSummaryLabel(scanSummary);
  const scanDisabledReason = scanEnabled ? null : 'Turn on scanning to rescan.';
  const noFilesToMove = storage !== null && storage.fileCount === 0;
  const nothingToClean = storage !== null && storage.reclaimableBytes === 0;
  const bottomPad = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + 66 + insets.bottom + space.xl;

  useEffect(() => {
    if (!visible) return;
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
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`Permission: ${permissionText}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Permission</Text>
                <Text style={styles.rowMeta}>Needed to scan this device for audio</Text>
              </View>
              <View style={styles.rowActions}>
                <Text style={styles.rowValue}>{permissionText}</Text>
                {permission !== null && permission !== 'granted' ? (
                  <Pressable
                    onPress={onGrant}
                    accessibilityRole="button"
                    accessibilityLabel="Grant audio permission"
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  >
                    <Text style={styles.actionText}>Grant</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {Platform.OS !== 'web' ? (
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Scan this device</Text>
                  <Text style={styles.rowMeta}>
                    {scanEnabled
                      ? 'Scanning for audio files on this device'
                      : 'Off. Imported files stay in your library.'}
                  </Text>
                </View>
                <Switch
                  value={scanEnabled}
                  onValueChange={onToggleScan}
                  disabled={scanning}
                  accessibilityLabel="Scan this device for audio"
                  trackColor={{ false: colors.surfaceHi, true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ) : null}

            <Pressable
              onPress={onRescan}
              disabled={!canRescan}
              accessibilityRole="button"
              accessibilityLabel="Rescan device audio"
              accessibilityState={{ disabled: !canRescan }}
              style={({ pressed }) => [
                styles.row,
                !canRescan && !scanning && styles.rowDisabled,
                pressed && canRescan && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Rescan device audio</Text>
                <Text style={styles.rowMeta}>{rescanMeta}</Text>
                {scanDisabledReason ? (
                  <Text style={styles.rowMeta}>{scanDisabledReason}</Text>
                ) : null}
              </View>
              {scanning ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
              )}
            </Pressable>

            <Pressable
              onPress={onOpenHiddenTracks}
              accessibilityRole="button"
              accessibilityLabel={hiddenTracksLabel(hiddenCount)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{hiddenTracksLabel(hiddenCount)}</Text>
                <Text style={styles.rowMeta}>Restore or remove hidden tracks</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            </Pressable>

            <Pressable
              onPress={onExcludeAll}
              disabled={scanExcludeCount === 0}
              accessibilityRole="button"
              accessibilityLabel="Exclude all scanned tracks"
              accessibilityState={{ disabled: scanExcludeCount === 0 }}
              style={({ pressed }) => [
                styles.row,
                scanExcludeCount === 0 && styles.rowDisabled,
                pressed && scanExcludeCount > 0 && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Exclude all scanned tracks</Text>
                <Text style={styles.rowMeta}>{excludeAllMeta(scanExcludeCount)}</Text>
              </View>
              <Ionicons name="eye-off-outline" size={22} color={colors.textDim} />
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
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Krotify {appJson.expo.version}</Text>
                <Text style={styles.rowMeta}>Local playback.</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Release ABI</Text>
              <Text style={styles.rowValue}>{RELEASE_ABI}</Text>
            </View>
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
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
  action: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
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
  saveError: {
    ...type.meta,
    color: colors.danger,
  },
});
