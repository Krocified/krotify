import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  colors: readonly [string, string];
  opacity?: number;
};

const BARS = [0.32, 0.55, 0.78, 0.46, 0.92, 0.62, 0.38, 0.7, 0.5, 0.84, 0.44, 0.64];

export function WavyVisualizer({ colors, opacity = 0.2 }: Props) {
  const reduceMotion = useReduceMotion();
  const [values] = useState(() => BARS.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (reduceMotion) {
      for (const value of values) value.setValue(0.45);
      return;
    }
    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 70),
          Animated.timing(value, {
            toValue: 1,
            duration: 780 + index * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 780 + index * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    for (const loop of loops) loop.start();
    return () => {
      for (const loop of loops) loop.stop();
    };
  }, [reduceMotion, values]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {BARS.map((height, index) => (
        <Animated.View
          key={`${height}-${index}`}
          style={[
            styles.bar,
            {
              height: 44 * height,
              backgroundColor: colors[index % 2],
              opacity,
              transform: [
                {
                  scaleY: values[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.45, 1.25],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
});
