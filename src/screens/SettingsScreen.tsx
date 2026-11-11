import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '../theme';
import type { LibraryStatus } from '../types';

type Props = {
  status: LibraryStatus;
  onRescan: () => void;
  onBack: () => void;
};

const PERMISSION_LABEL: Partial<Record<LibraryStatus, string>> = {
  ready: 'Granted',
  denied: 'Not granted',
};

export function SettingsScreen({ status, onRescan, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const scanning = status === 'scanning';
  const permission = PERMISSION_LABEL[status] ?? 'Checking';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={space.sm}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
        >
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
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
              <Text style={styles.rowGlyph}>›</Text>
            )}
          </Pressable>
        </View>

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
            <Text style={styles.rowValue}>krotify 0.1.0</Text>
          </View>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconPressed: {
    backgroundColor: colors.surfaceHi,
  },
  chevron: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
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
  rowGlyph: {
    color: colors.textDim,
    fontSize: 24,
    lineHeight: 26,
  },
});
