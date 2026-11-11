import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { formatDuration } from '../lib/format';
import { colors, space, type } from '../theme';

type Props = {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
};

export function ProgressBar({ positionMs, durationMs, onSeek }: Props) {
  const [width, setWidth] = useState(0);
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  function handlePress(locationX: number) {
    if (width <= 0 || durationMs <= 0) return;
    const clamped = Math.min(1, Math.max(0, locationX / width));
    onSeek(Math.round(clamped * durationMs));
  }

  return (
    <View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(positionMs)}</Text>
        <Text style={styles.time}>{formatDuration(durationMs)}</Text>
      </View>
      <Pressable
        onLayout={handleLayout}
        onPress={(event) => handlePress(event.nativeEvent.locationX)}
        accessibilityRole="progressbar"
        accessibilityLabel="Seek"
        accessibilityValue={{
          min: 0,
          max: Math.round(durationMs / 1000),
          now: Math.round(positionMs / 1000),
        }}
        style={styles.seeker}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: width * ratio }]} />
          {width > 0 ? <View style={[styles.thumb, { left: width * ratio - 6 }]} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  time: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  seeker: {
    paddingVertical: space.sm,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff1f',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
});
