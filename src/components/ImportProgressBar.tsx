import { Pressable, StyleSheet, Text, View } from 'react-native';
import { importProgressFraction, importProgressLabel, type ImportProgress } from '../lib/importProgress';
import { colors, radius, space, type } from '../theme';

type Props = {
  progress: ImportProgress;
  onCancel: () => void;
};

export function ImportProgressBar({ progress, onCancel }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          {importProgressLabel(progress)}
        </Text>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel import"
          hitSlop={space.sm}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${importProgressFraction(progress) * 100}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    paddingTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  label: {
    ...type.meta,
    color: colors.text,
    flex: 1,
  },
  cancel: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  cancelText: {
    ...type.meta,
    color: colors.textDim,
  },
  pressed: {
    opacity: 0.7,
  },
  track: {
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceHi,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
});
