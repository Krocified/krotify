import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AmbientTheme } from '../lib/ambient';

type Props = {
  theme: AmbientTheme;
};

export const AmbientBackdrop = memo(function AmbientBackdrop({ theme }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[`${theme.top}99`, `${theme.base}66`, theme.bottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});
