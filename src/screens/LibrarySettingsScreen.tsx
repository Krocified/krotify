import { Ionicons } from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
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
import { colors, radius, space, type } from '../theme';
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
      style={[styles.root, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={styles.title}>Library settings</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.flex}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
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
              accessibilityLabel={hiddenTracksLabel()}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{hiddenTracksLabel()}</Text>
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
  flex: {
    flex: 1,
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
});
