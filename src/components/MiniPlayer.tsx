import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { usePlayerActions, usePlayerStatus } from '../player/PlayerProvider';
import { coverColors } from '../lib/cover';
import { adjustColor } from '../lib/ambient';
import { useCoverColor } from '../library/useCoverColor';
import { colors, space, type } from '../theme';
import { BlurPill } from './BlurPill';
import { CoverArt } from './CoverArt';
import { MarqueeText } from './MarqueeText';
import { Visualizer } from './Visualizer';

type Props = {
  onExpand: () => void;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
};

export const MINI_PLAYER_HEIGHT = 68;

export function MiniPlayer({ onExpand, blurTarget }: Props) {
  const { track, isPlaying, queueLength } = usePlayerStatus();
  const { toggle, skipNext, skipPrevious, stop } = usePlayerActions();
  const [contentX] = useState(() => new Animated.Value(0));
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const canSkipRef = useRef(queueLength > 1);
  const skipNextRef = useRef(skipNext);
  const skipPreviousRef = useRef(skipPrevious);
  const animatingRef = useRef(false);

  useEffect(() => {
    canSkipRef.current = queueLength > 1;
    skipNextRef.current = skipNext;
    skipPreviousRef.current = skipPrevious;
  }, [queueLength, skipNext, skipPrevious]);

  const panResponder = useMemo(
    () =>
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

          if (!(forward || backward) || !canSkipRef.current) {
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
            if (forward) skipNextRef.current();
            else skipPreviousRef.current();
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

  const coverColor = useCoverColor(track?.artworkUri);
  const visualizerColors: readonly [string, string] = coverColor
    ? [adjustColor(coverColor, 0.38), adjustColor(coverColor, -0.12)]
    : coverColors(track?.artworkHue ?? 0);
  const visualizerKey = track?.id ?? 'none';

  if (!track) return null;

  return (
    <BlurPill
      style={styles.wrap}
      contentStyle={styles.pillContent}
      blurTarget={blurTarget}
      intensity={45}
    >
      <Visualizer
        key={visualizerKey}
        seed={track.id}
        colors={visualizerColors}
        isPlaying={isPlaying}
        opacity={0.45}
      />
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
                size={50}
                radius={25}
                uri={track.artworkUri}
              />
              <View style={styles.texts}>
                <MarqueeText
                  text={track.title}
                  style={styles.title}
                  startPauseMs={1000}
                  endPauseMs={1400}
                />
                <MarqueeText
                  text={track.artist}
                  style={styles.artist}
                  startPauseMs={1000}
                  endPauseMs={1400}
                />
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
    </BlurPill>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 32,
  },
  pillContent: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
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
    gap: space.md - space.xs,
    paddingLeft: 8,
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
