import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SPATIAL_MODES, spatialModeLabel, type SpatialMode } from '../lib/spatial';
import { colors, radius, space, type } from '../theme';

type Props = {
  mode: SpatialMode;
  supported: boolean | null;
  onSelect: (mode: SpatialMode) => void;
};

export function SpatialAudioControls({ mode, supported, onSelect }: Props) {
  const disabled = supported === false;
  return (
    <View style={styles.chips}>
      {SPATIAL_MODES.map((option) => {
        const selected = option === mode;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Spatial audio ${spatialModeLabel(option)}`}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              disabled && styles.chipDisabled,
              pressed && !disabled && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {spatialModeLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  chipDisabled: {
    opacity: 0.4,
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
});
