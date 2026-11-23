import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SLEEP_PRESETS, formatSleepRemaining, type SleepMode, type SleepPreset } from '../lib/sleepTimer';
import { colors, radius, space, type } from '../theme';


type Props = {
  mode: SleepMode;
  remainingMs: number;
  onSelect: (preset: SleepPreset) => void;
  onCancel: () => void;
};

function presetLabel(preset: SleepPreset): string {
  return preset === 'end' ? 'End of track' : `${preset} min`;
}

export function SleepTimerControls({ mode, remainingMs, onSelect, onCancel }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {SLEEP_PRESETS.map((preset) => {
          const selected = preset === 'end' && mode === 'end';
          return (
            <Pressable
              key={String(preset)}
              onPress={() => onSelect(preset)}
              accessibilityRole="button"
              accessibilityLabel={
                preset === 'end' ? 'Sleep at end of track' : `Sleep in ${preset} minutes`
              }
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {presetLabel(preset)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mode !== 'off' ? (
        <View style={styles.statusRow}>
          <Text style={styles.status}>{formatSleepRemaining(mode, remainingMs)}</Text>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel sleep timer"
            style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  chipText: {
    ...type.meta,
    color: colors.textDim,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    ...type.meta,
    color: colors.textDim,
  },
  cancel: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.screen,
  },
  cancelPressed: {
    backgroundColor: colors.surfaceHi,
  },
  cancelText: {
    ...type.meta,
    color: colors.accent2,
  },
});
