import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '../theme';

type Props = {
  scrollY: SharedValue<number>;
  contentHeight: number;
  viewportHeight: number;
  bottomOffset: number;
  onScrollTo?: (offset: number) => void;
};

const HIDE_MS = 700;
const SHOW_THROTTLE_MS = 120;

export function ScrollBar({
  scrollY,
  contentHeight,
  viewportHeight,
  bottomOffset,
  onScrollTo,
}: Props) {
  const [trackHeight, setTrackHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [held, setHeld] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef(0);
  const lastShowAt = useSharedValue(0);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_MS);
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useAnimatedReaction(
    () => scrollY.value,
    (value, previous) => {
      if (value === previous) return;
      const now = performance.now();
      if (now - lastShowAt.value < SHOW_THROTTLE_MS) return;
      lastShowAt.value = now;
      runOnJS(show)();
    },
    [show],
  );

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const maxScroll = Math.max(contentHeight - viewportHeight, 1);
  const thumbHeight =
    trackHeight > 0
      ? Math.min(
          trackHeight,
          Math.max(12, (viewportHeight / contentHeight) * trackHeight * 0.375),
        )
      : 0;
  const maxTranslate = Math.max(trackHeight - thumbHeight, 0);
  const wide = active || held;

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, maxScroll],
            [0, maxTranslate],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [maxScroll, maxTranslate]);

  const panResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          setActive(true);
          setVisible(true);
          dragStart.current = scrollY.value;
          if (hideTimer.current) clearTimeout(hideTimer.current);
        },
        onPanResponderMove: (_, gesture) => {
          if (!onScrollTo || maxTranslate <= 0) return;
          const next = dragStart.current + (gesture.dy * maxScroll) / maxTranslate;
          onScrollTo(Math.min(maxScroll, Math.max(0, next)));
        },
        onPanResponderRelease: () => {
          setActive(false);
          scheduleHide();
        },
        onPanResponderTerminate: () => {
          setActive(false);
          scheduleHide();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [maxScroll, maxTranslate, onScrollTo, scheduleHide, scrollY],
  );

  if (!contentHeight || !viewportHeight || contentHeight <= viewportHeight || !visible) {
    return null;
  }

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(event: LayoutChangeEvent) => setTrackHeight(event.nativeEvent.layout.height)}
      style={[styles.track, { bottom: bottomOffset }]}
    >
      <Pressable
        style={styles.hit}
        onHoverIn={() => setHeld(true)}
        onHoverOut={() => setHeld(false)}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
      />
      {trackHeight > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { width: wide ? 6 : 3, height: thumbHeight }, thumbStyle]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    right: 2,
    top: 0,
    width: 6,
    alignItems: 'flex-end',
  },
  hit: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  thumb: {
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
});
