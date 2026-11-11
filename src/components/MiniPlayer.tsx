import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../player/PlayerProvider';
import { colors, space, type } from '../theme';
import { CoverArt } from './CoverArt';

type Props = {
  onExpand: () => void;
};

export function MiniPlayer({ onExpand }: Props) {
  const { track, isPlaying, positionMs, durationMs, toggle, stop } = usePlayer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [progress] = useState(() =>
    new Animated.Value(durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0),
  );
  const [offsetX] = useState(() => new Animated.Value(0));
  const [offsetY] = useState(() => new Animated.Value(0));
  const expandRef = useRef(onExpand);
  const stopRef = useRef(stop);
  const widthRef = useRef(width);

  useEffect(() => {
    expandRef.current = onExpand;
    stopRef.current = stop;
    widthRef.current = width;
  }, [onExpand, stop, width]);

  useEffect(() => {
    const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
    Animated.timing(progress, {
      toValue: ratio,
      duration: 500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [positionMs, durationMs, progress]);

  useEffect(() => {
    offsetX.setValue(0);
    offsetY.setValue(0);
  }, [track?.id, offsetX, offsetY]);

  const panResponder = useMemo(
    () =>
      // ponytail: handlers read refs only at event time, never during render
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 || Math.abs(gesture.dy) > 12,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 12 || Math.abs(gesture.dy) > 12,
        onPanResponderMove: (_, gesture) => {
          offsetX.setValue(gesture.dx);
          offsetY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -40) {
            offsetX.setValue(0);
            offsetY.setValue(0);
            expandRef.current();
            return;
          }
          const dismissSideways = Math.abs(gesture.dx) > 60;
          const dismissDown = gesture.dy > 40;
          if (dismissSideways || dismissDown) {
            Animated.parallel([
              Animated.timing(offsetX, {
                toValue: dismissSideways ? Math.sign(gesture.dx) * widthRef.current : 0,
                duration: 160,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: false,
              }),
              Animated.timing(offsetY, {
                toValue: dismissDown ? gesture.dy + 80 : 0,
                duration: 160,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: false,
              }),
            ]).start(({ finished }) => {
              if (finished) stopRef.current();
            });
            return;
          }
          Animated.parallel([
            Animated.spring(offsetX, { toValue: 0, useNativeDriver: false }),
            Animated.spring(offsetY, { toValue: 0, useNativeDriver: false }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(offsetX, { toValue: 0, useNativeDriver: false }),
            Animated.spring(offsetY, { toValue: 0, useNativeDriver: false }),
          ]).start();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [offsetX, offsetY],
  );

  if (!track) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom, transform: [{ translateX: offsetX }, { translateY: offsetY }] },
      ]}
    >
      <View style={styles.progressTrack} pointerEvents="none">
        <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
      </View>
      <View style={styles.bar}>
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel="Open now playing"
          style={({ pressed }) => [styles.expand, pressed && styles.pressed]}
        >
          <CoverArt hue={track.artworkHue} title={track.title} size={44} radius={4} />
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
        </Pressable>
        <Pressable
          onPress={stop}
          accessibilityRole="button"
          accessibilityLabel="Close player"
          hitSlop={space.sm}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Pressable>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceHi,
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#ffffff1f',
  },
  progressFill: {
    width: '100%',
    height: 2,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.sm,
  },
  expand: {
    flex: 1,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.md,
  },
  pressed: {
    backgroundColor: '#262633',
  },
  title: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  togglePressed: {
    backgroundColor: '#ffffff14',
  },
});
