import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePlayer } from '../player/PlayerProvider';
import { colors, space, type } from '../theme';
import { CoverArt } from './CoverArt';

type Props = {
  onExpand: () => void;
};

export function MiniPlayer({ onExpand }: Props) {
  const { track, isPlaying, positionMs, durationMs, hasNext, hasPrevious, toggle, next, previous, stop } =
    usePlayer();
  const [progress] = useState(() =>
    new Animated.Value(durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0),
  );
  const [contentX] = useState(() => new Animated.Value(0));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const hasNextRef = useRef(hasNext);
  const hasPreviousRef = useRef(hasPrevious);
  const nextRef = useRef(next);
  const previousRef = useRef(previous);
  const animatingRef = useRef(false);

  useEffect(() => {
    hasNextRef.current = hasNext;
    hasPreviousRef.current = hasPrevious;
    nextRef.current = next;
    previousRef.current = previous;
  }, [hasNext, hasPrevious, next, previous]);

  useEffect(() => {
    const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
    Animated.timing(progress, {
      toValue: ratio,
      duration: 500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [positionMs, durationMs, progress]);

  const panResponder = useMemo(
    () =>
      // ponytail: handlers read refs only at event time, never during render
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          if (animatingRef.current) return;
          contentX.setValue(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          if (animatingRef.current) return;
          const forward = gesture.dx < -50;
          const backward = gesture.dx > 50;
          const allowed = forward ? hasNextRef.current : backward ? hasPreviousRef.current : false;

          if (!(forward || backward) || !allowed) {
            Animated.parallel([
              Animated.spring(contentX, { toValue: 0, useNativeDriver: true }),
              Animated.timing(contentOpacity, {
                toValue: 1,
                duration: 110,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }

          animatingRef.current = true;
          const direction = forward ? -1 : 1;
          Animated.parallel([
            Animated.timing(contentX, {
              toValue: direction * 40,
              duration: 110,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(contentOpacity, {
              toValue: 0,
              duration: 110,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (forward) nextRef.current();
            else previousRef.current();
            contentX.setValue(-direction * 40);
            Animated.parallel([
              Animated.timing(contentX, {
                toValue: 0,
                duration: 130,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(contentOpacity, {
                toValue: 1,
                duration: 130,
                useNativeDriver: true,
              }),
            ]).start(() => {
              animatingRef.current = false;
            });
          });
        },
        onPanResponderTerminate: () => {
          if (animatingRef.current) return;
          Animated.parallel([
            Animated.spring(contentX, { toValue: 0, useNativeDriver: true }),
            Animated.timing(contentOpacity, {
              toValue: 1,
              duration: 110,
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [contentX, contentOpacity],
  );

  if (!track) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.progressTrack} pointerEvents="none">
        <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
      </View>
      <View style={styles.bar}>
        <View style={styles.contentClip}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.content,
              { transform: [{ translateX: contentX }], opacity: contentOpacity },
            ]}
          >
            <Pressable
              onPress={onExpand}
              accessibilityRole="button"
              accessibilityLabel="Open now playing"
              style={({ pressed }) => [styles.expand, pressed && styles.pressed]}
            >
              <CoverArt
                hue={track.artworkHue}
                title={track.title}
                size={44}
                radius={4}
                uri={track.artworkUri}
              />
              <View style={styles.texts}>
                <Text style={styles.title} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHi,
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#ffffff1f',
  },
  progressFill: {
    width: '100%',
    height: 2,
    backgroundColor: colors.accentBright,
    transformOrigin: 'left',
  },
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.sm,
  },
  contentClip: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
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
  texts: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  artist: {
    ...type.meta,
    color: colors.textDim,
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
