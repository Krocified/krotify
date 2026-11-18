import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AMBIENT_POOL_COUNT, type AmbientTheme } from '../lib/ambient';
import { colors } from '../theme';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  theme: AmbientTheme;
};

export function AmbientBackdrop({ theme }: Props) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [values] = useState(() =>
    Array.from({ length: AMBIENT_POOL_COUNT }, () => new Animated.Value(0)),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion || !appActive) {
      for (const value of values) value.stopAnimation();
      return;
    }
    const loops = theme.pools.map((pool, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(pool.delayMs),
          Animated.timing(values[index], {
            toValue: 1,
            duration: pool.durationMs / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(values[index], {
            toValue: 0,
            duration: pool.durationMs / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    for (const loop of loops) loop.start();
    return () => {
      for (const loop of loops) loop.stop();
      for (const value of values) value.setValue(0);
    };
  }, [appActive, reduceMotion, theme, values]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[`${theme.top}80`, `${theme.base}40`, theme.bottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {theme.pools.map((pool, index) => {
        const size = pool.size * width;
        const value = values[index];
        if (!value) return null;
        return (
          <Animated.View
            key={`${pool.color}-${index}`}
            style={[
              styles.pool,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                left: pool.x * width - size / 2,
                top: pool.y * height - size / 2,
                transform: [
                  {
                    translateX: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, pool.driftX * width],
                    }),
                  },
                  {
                    translateY: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, pool.driftY * height],
                    }),
                  },
                  {
                    scale: value.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.16],
                    }),
                  },
                ],
                opacity: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [pool.opacity * 0.55, pool.opacity],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={[`${pool.color}33`, `${pool.color}00`]}
              start={{ x: 0.5, y: 0.2 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pool: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});
