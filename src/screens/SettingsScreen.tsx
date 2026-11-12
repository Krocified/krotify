import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackPill } from '../components/ScreenHeader';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { colors, radius, space, type } from '../theme';
import type { LibraryStatus, Track } from '../types';

type Props = {
  visible: boolean;
  status: LibraryStatus;
  onRescan: () => void;
  onBack: () => void;
  onImport: () => void;
  excluded: Track[];
  onRestore: (id: string) => void;
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
  excluded,
  onRestore,
  importing = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));
  const scanning = status === 'scanning';
  const permission = PERMISSION_LABEL[status] ?? 'Checking';
  const bottomPad = TAB_BAR_HEIGHT + 66 + insets.bottom + space.xl;

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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
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
              <Text style={styles.rowTitle}>Library</Text>
              <Text style={styles.rowMeta}>Rescan device audio</Text>
            </View>
            {scanning ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
            )}
          </Pressable>
        </View>

        {Platform.OS !== 'web' ? (
          <View style={styles.card}>
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
          </View>
        ) : null}

        {excluded.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>Hidden tracks</Text>
            </View>
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
        ) : null}

        <View style={styles.card}>
          <View style={styles.row} accessible accessibilityLabel={`Permission: ${permission}`}>
            <Text style={styles.rowTitle}>Permission</Text>
            <Text style={styles.rowValue}>{permission}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>About</Text>
              <Text style={styles.rowMeta}>Local files only. No network.</Text>
            </View>
            <Text style={styles.rowValue}>Krotify 0.1.0</Text>
          </View>
        </View>
      </ScrollView>
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
