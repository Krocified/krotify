import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appJson from '../../app.json';
import { BackPill } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { useScrollProgress } from '../components/useScrollProgress';
import { colors, radius, space, type } from '../theme';
import type { LibraryStatus, Track } from '../types';

type Props = {
  visible: boolean;
  status: LibraryStatus;
  onRescan: () => void;
  onBack: () => void;
  onImport: () => void;
  onExcludeAll: () => void;
  excluded: Track[];
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
  canExcludeAll: boolean;
  importing?: boolean;
};

const PERMISSION_LABEL: Partial<Record<LibraryStatus, string>> = {
  ready: 'Granted',
  denied: 'Not granted',
};

const SLIDE_MS = 280;

export function SettingsScreen({
  visible,
  status,
  onRescan,
  onBack,
  onImport,
  onExcludeAll,
  excluded,
  onRestore,
  onRestoreAll,
  canExcludeAll,
  importing = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { width } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));
  const scanning = status === 'scanning';
  const permission = PERMISSION_LABEL[status] ?? 'Checking';
  const bottomPad = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + 66 + insets.bottom + space.xl;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, visible]);

  return (
    <Animated.View
      style={[
        styles.root,
        {
          transform: [
            {
              translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }),
            },
          ],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={styles.title}>Settings</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          {...scrollHandlers}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          <Text style={styles.sectionTitle}>Library</Text>
          <View style={styles.card}>
            <Pressable
              onPress={onRescan}
              disabled={scanning}
              accessibilityRole="button"
              accessibilityLabel="Rescan device audio"
              accessibilityState={{ disabled: scanning }}
              style={({ pressed }) => [styles.row, pressed && !scanning && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Rescan device audio</Text>
                <Text style={styles.rowMeta}>Scan this device for audio files</Text>
              </View>
              {scanning ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
              )}
            </Pressable>

            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={onImport}
                disabled={importing}
                accessibilityRole="button"
                accessibilityLabel="Import audio files"
                accessibilityState={{ disabled: importing, busy: importing }}
                style={({ pressed }) => [styles.row, pressed && !importing && styles.rowPressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Import audio files</Text>
                  <Text style={styles.rowMeta}>Copy audio files into the app</Text>
                </View>
                {importing ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="add" size={22} color={colors.textDim} />
                )}
              </Pressable>
            ) : null}

            <Pressable
              onPress={onExcludeAll}
              disabled={!canExcludeAll}
              accessibilityRole="button"
              accessibilityLabel="Exclude all scanned tracks"
              accessibilityState={{ disabled: !canExcludeAll }}
              style={({ pressed }) => [
                styles.row,
                !canExcludeAll && styles.rowDisabled,
                pressed && canExcludeAll && styles.rowPressed,
              ]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Exclude all scanned tracks</Text>
                <Text style={styles.rowMeta}>Hide every scanned track from the library</Text>
              </View>
              <Ionicons name="eye-off-outline" size={22} color={colors.textDim} />
            </Pressable>

            <View style={styles.row} accessible accessibilityLabel={`Permission: ${permission}`}>
              <Text style={styles.rowTitle}>Permission</Text>
              <Text style={styles.rowValue}>{permission}</Text>
            </View>
          </View>

          {excluded.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Hidden tracks</Text>
              <View style={styles.card}>
                <Pressable
                  onPress={onRestoreAll}
                  accessibilityRole="button"
                  accessibilityLabel="Restore all hidden tracks"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Restore all hidden tracks</Text>
                    <Text style={styles.rowMeta}>
                      {excluded.length} hidden {excluded.length === 1 ? 'track' : 'tracks'}
                    </Text>
                  </View>
                  <Ionicons name="refresh" size={22} color={colors.accent2} />
                </Pressable>
                {excluded.map((track) => (
                  <View key={track.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onRestore(track.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Restore ${track.title}`}
                      style={({ pressed }) => [styles.restore, pressed && styles.restorePressed]}
                    >
                      <Text style={styles.restoreText}>Restore</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Krotify {appJson.expo.version}</Text>
                <Text style={styles.rowMeta}>Local files only. No network.</Text>
              </View>
            </View>
          </View>
        </Animated.ScrollView>
        <ScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bottomOffset={TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8}
        />
      </View>
    </Animated.View>
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
  restore: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  restorePressed: {
    opacity: 0.7,
  },
  restoreText: {
    ...type.meta,
    color: colors.accent2,
  },
});
