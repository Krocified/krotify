import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as Application from 'expo-application';
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
import { usePlayerActions, usePlayerStatus } from '../player/PlayerProvider';
import { colors, radius, space, type } from '../theme';
import { SettingsRow, SettingsSection } from '../ui/Settings';
import { ui } from '../ui/styles';

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
  const version = Application.nativeApplicationVersion ?? appJson.expo.version;
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { sleep } = usePlayerStatus();
  const { setSleep } = usePlayerActions();
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
      style={[ui.overlay, !visible && ui.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={ui.title}>Settings</Text>
        <View style={ui.iconButton} />
      </View>

      <KeyboardAvoidingView
        style={ui.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          {...scrollHandlers}
          contentContainerStyle={[ui.content, { paddingBottom: bottomPad }]}
        >
          <SettingsSection title="Library">
            <SettingsRow
              title="Library settings"
              meta="Permission, scanning, hidden tracks"
              onPress={onOpenLibrarySettings}
              trailing={<Ionicons name="chevron-forward" size={22} color={colors.textDim} />}
            />
          </SettingsSection>

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

          <SettingsSection title="Tags">
            <SettingsRow
              title="Manage tags"
              meta="Create and delete tags"
              onPress={onOpenTags}
              trailing={<Ionicons name="chevron-forward" size={22} color={colors.textDim} />}
            />
          </SettingsSection>

          <SettingsSection title="Storage">
            <SettingsRow
              title="Current folder"
              meta="Where imported files are stored"
              value={storage === null ? 'Loading storage...' : storage.folderName}
              accessibilityLabel="Current storage folder"
            />

            <SettingsRow
              title="Change folder"
              meta="Choose a new folder for imported files"
              onPress={onChangeFolder}
              disabled={storageBusy}
              accessibilityLabel="Change folder"
              trailing={<Ionicons name="chevron-forward" size={22} color={colors.textDim} />}
            />

            <SettingsRow
              title="Move existing files"
              meta={
                noFilesToMove
                  ? 'No files to move.'
                  : storage === null
                    ? 'Loading storage...'
                    : moveFilesLabel(storage.fileCount, storage.totalBytes)
              }
              onPress={onMoveFiles}
              disabled={storageBusy || noFilesToMove}
              accessibilityLabel="Move existing files"
              trailing={<Ionicons name="chevron-forward" size={22} color={colors.textDim} />}
            />

            <SettingsRow
              title="Reclaimable space"
              meta={
                nothingToClean
                  ? 'Nothing to clean.'
                  : storage === null
                    ? 'Loading storage...'
                    : reclaimableLabel(storage.reclaimableBytes)
              }
              onPress={onCleanStorage}
              disabled={storageBusy || nothingToClean}
              accessibilityLabel="Clean reclaimable space"
              trailing={<Text style={ui.actionText}>Clean</Text>}
            />

            {LINK_IMPORT_ENABLED ? (
              <View style={styles.linkFields}>
                <View style={ui.field}>
                  <Text style={ui.fieldLabel}>Link service URL</Text>
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
                    style={ui.input}
                  />
                </View>
                <View style={ui.field}>
                  <Text style={ui.fieldLabel}>Link service token</Text>
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
                    style={ui.input}
                  />
                </View>
                <Pressable
                  onPress={() => void saveLinkConfig()}
                  disabled={linkBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Save link service settings"
                  accessibilityState={{ disabled: linkBusy, busy: linkBusy }}
                  style={({ pressed }) => [
                    ui.primaryButton,
                    linkBusy && ui.disabled,
                    pressed && !linkBusy && ui.actionPressed,
                  ]}
                >
                  {linkBusy ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={ui.primaryButtonText}>Save</Text>
                  )}
                </Pressable>
                {linkNote ? <Text style={styles.saveNote}>{linkNote}</Text> : null}
                {linkError ? <Text style={styles.saveError}>{linkError}</Text> : null}
              </View>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Playback">
            <View style={styles.stackRow}>
              <View style={ui.rowText}>
                <Text style={ui.rowTitle}>Sleep timer</Text>
                <Text style={ui.rowMeta}>Fade out and stop playback after the timer</Text>
              </View>
              <SleepTimerControls
                mode={sleep.mode}
                remainingMs={sleep.remainingMs}
                onSelect={selectSleepPreset}
                onCancel={() => setSleep('off')}
              />
            </View>
          </SettingsSection>

          <SettingsSection title="About">
            <SettingsRow
              title={`Krotify ${version}`}
              meta="Local playback."
              onPress={onOpenTechStack}
              accessibilityLabel={`Krotify ${version}, view tech stack`}
              trailing={<Ionicons name="chevron-forward" size={22} color={colors.textDim} />}
            />
            <SettingsRow title="Release ABI" value={RELEASE_ABI} />
            <CreatedByKrocified />
          </SettingsSection>
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
  stackRow: {
    gap: space.md,
    padding: space.md,
  },
  linkFields: {
    gap: space.sm,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff10',
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
