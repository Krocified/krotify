import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AMBIENT_BLOBS, BLOB_LOOP_MS, type AmbientBlob } from '../lib/ambientBlobs';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  colors: readonly [string, string];
  isPlaying: boolean;
  opacity?: number;
};

const FRAME_INTERVAL_MS = 33;
const FRAME_CAP_MS = 100;

function Blob({
  blob,
  colors,
  progress,
  width,
  height,
}: {
  blob: AmbientBlob;
  colors: readonly [string, string];
  progress: SharedValue<number>;
  width: number;
  height: number;
}) {
  const size = blob.size * width;
  const color = colors[blob.colorIndex];

  const motion = useAnimatedStyle(() => {
    const turn = progress.value * Math.PI * 2;
    return {
      transform: [
        { translateX: Math.sin(turn * blob.fx + blob.phase) * blob.driftX * width },
        { translateY: Math.cos(turn * blob.fy + blob.phase * 1.7) * blob.driftY * height },
        { scale: 1 + Math.sin(turn * blob.fs + blob.phase * 0.6) * blob.scaleAmp },
      ],
      opacity: blob.opacity * (0.75 + 0.25 * Math.sin(turn * blob.fo + blob.phase)),
    };
  });

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: blob.x * width - size / 2,
          top: blob.y * height - size / 2,
        },
        motion,
      ]}
    >
      <LinearGradient
        colors={[`${color}55`, `${color}22`, `${color}00`]}
        start={{ x: 0.5, y: 0.12 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export function Visualizer({ colors, isPlaying, opacity = 0.2 }: Props) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const elapsed = useSharedValue(0);
  const pendingMs = useSharedValue(0);

  const frame = useFrameCallback((info) => {
    pendingMs.value += Math.min(info.timeSincePreviousFrame ?? 16, FRAME_CAP_MS);
    if (pendingMs.value < FRAME_INTERVAL_MS) return;
    elapsed.value += Math.min(pendingMs.value, FRAME_CAP_MS);
    pendingMs.value = 0;
  }, false);

  useEffect(() => {
    frame.setActive(isPlaying && !reduceMotion);
    return () => frame.setActive(false);
  }, [frame, isPlaying, reduceMotion]);

  const progress = useDerivedValue(() => (elapsed.value % BLOB_LOOP_MS) / BLOB_LOOP_MS);

  return (
    <View pointerEvents="none" style={[styles.fill, { opacity }]}>
      {AMBIENT_BLOBS.map((blob, index) => (
        <Blob
          key={index}
          blob={blob}
          colors={colors}
          progress={progress}
          width={width}
          height={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
