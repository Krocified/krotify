import { Ionicons } from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackPill } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { useScrollProgress } from '../components/useScrollProgress';
import type { ScanSummary } from '../db/settings';
import {
  excludeAllMeta,
  hiddenTracksLabel,
  permissionLabel,
  scanResultLabel,
  type PermissionState,
} from '../lib/settingsView';
import { colors, space } from '../theme';
import { SettingsRow, SettingsSection } from '../ui/Settings';
import { ui } from '../ui/styles';
import type { LibraryStatus } from '../types';

type Props = {
  visible: boolean;
  status: LibraryStatus;
  scanEnabled: boolean;
  permission: PermissionState | null;
  scanSummary: ScanSummary | null;
  scanExcludeCount: number;
  onBack: () => void;
  onToggleScan: (enabled: boolean) => void;
  onGrant: () => void;
  onRescan: () => void;
  onOpenHiddenTracks: () => void;
  onExcludeAll: () => void;
};

function scanSummaryLabel(summary: ScanSummary): string {
  const result = scanResultLabel(summary.found, summary.newTracks, summary.missing);
  return `${result} · ${new Date(summary.lastScanAt).toLocaleString()}`;
}

export function LibrarySettingsScreen({
  visible,
  status,
  scanEnabled,
  permission,
  scanSummary,
  scanExcludeCount,
  onBack,
  onToggleScan,
  onGrant,
  onRescan,
  onOpenHiddenTracks,
  onExcludeAll,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const scanning = status === 'scanning';
  const canRescan = scanEnabled && !scanning;
  const permissionText = permission === null ? 'Checking' : permissionLabel(permission);
  const rescanMeta =
    scanSummary === null ? 'No scan yet' : scanSummaryLabel(scanSummary);
  const scanDisabledReason = scanEnabled ? null : 'Turn on scanning to rescan.';
  const bottomPad = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + 66 + insets.bottom + space.xl;

  return (
    <View
      style={[ui.overlay, !visible && ui.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={ui.title}>Library settings</Text>
        <View style={ui.iconButton} />
      </View>

      <View style={ui.flex}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          {...scrollHandlers}
          contentContainerStyle={[ui.content, { paddingBottom: bottomPad }]}
        >
          <SettingsSection title="Library">
            <SettingsRow
              title="Permission"
              meta="Needed to scan this device for audio"
              accessibilityLabel={`Permission: ${permissionText}`}
              trailing={
                <View style={ui.rowActions}>
                  <Text style={ui.rowValue}>{permissionText}</Text>
                  {permission !== null && permission !== 'granted' ? (
                    <Pressable
                      onPress={onGrant}
                      accessibilityRole="button"
                      accessibilityLabel="Grant audio permission"
                      style={({ pressed }) => [ui.action, pressed && ui.actionPressed]}
                    >
                      <Text style={ui.actionText}>Grant</Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />

            {Platform.OS !== 'web' ? (
              <SettingsRow
                title="Scan this device"
                meta={
                  scanEnabled
                    ? 'Scanning for audio files on this device'
                    : 'Off. Imported files stay in your library.'
                }
                trailing={
                  <Switch
                    value={scanEnabled}
                    onValueChange={onToggleScan}
                    disabled={scanning}
                    accessibilityLabel="Scan this device for audio"
                    trackColor={{ false: colors.surfaceHi, true: colors.accent }}
                    thumbColor="#FFFFFF"
                  />
                }
              />
            ) : null}

            <SettingsRow
              title="Rescan device audio"
              meta={
                scanDisabledReason ? (
                  <>
                    <Text style={ui.rowMeta}>{rescanMeta}</Text>
                    <Text style={ui.rowMeta}>{scanDisabledReason}</Text>
                  </>
                ) : (
                  rescanMeta
                )
              }
              onPress={onRescan}
              disabled={!canRescan}
              accessibilityLabel="Rescan device audio"
              trailing={
                scanning ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
                )
              }
            />

            <SettingsRow
              title={hiddenTracksLabel()}
              meta="Restore or remove hidden tracks"
              onPress={onOpenHiddenTracks}
              accessibilityLabel={hiddenTracksLabel()}
              trailing={<Ionicons name="chevron-forward" size={22} color={colors.textDim} />}
            />

            <SettingsRow
              title="Exclude all scanned tracks"
              meta={excludeAllMeta(scanExcludeCount)}
              onPress={onExcludeAll}
              disabled={scanExcludeCount === 0}
              accessibilityLabel="Exclude all scanned tracks"
              trailing={<Ionicons name="eye-off-outline" size={22} color={colors.textDim} />}
            />
          </SettingsSection>
        </Animated.ScrollView>
        <ScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bottomOffset={TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8}
        />
      </View>
    </View>
  );
}
