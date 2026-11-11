import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
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

const STEP_MS = 10_000;
const GLIDE_MS = 500;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function ProgressBar({ positionMs, durationMs, onSeek }: Props) {
  const [width, setWidth] = useState(0);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const [pendingSeekMs, setPendingSeekMs] = useState<number | null>(null);
  const barRef = useRef<ComponentRef<typeof View>>(null);
  const leftRef = useRef(0);
  const widthRef = useRef(0);
  const durationRef = useRef(durationMs);
  const draggingRef = useRef(false);
  const onSeekRef = useRef(onSeek);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  const pendingVisible = pendingSeekMs !== null && Math.abs(positionMs - pendingSeekMs) > 1500;
  const displayMs = dragMs ?? (pendingVisible ? pendingSeekMs : null) ?? positionMs;

  useEffect(() => {
    if (dragMs !== null) return;
    const target = durationMs > 0 ? clamp01(displayMs / durationMs) : 0;
    Animated.timing(progress, {
      toValue: target,
      duration: GLIDE_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [displayMs, durationMs, dragMs, progress]);

  const positionFromPageX = useCallback((pageX: number) => {
    const barWidth = widthRef.current;
    const barDuration = durationRef.current;
    if (barWidth <= 0 || barDuration <= 0) return 0;
    const ratio = clamp01((pageX - leftRef.current) / barWidth);
    return Math.round(ratio * barDuration);
  }, []);

  const panResponder = useMemo(
    () =>
      // ponytail: handlers read refs only at event time, never during render
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          draggingRef.current = true;
          const ms = positionFromPageX(event.nativeEvent.pageX);
          progress.stopAnimation();
          progress.setValue(durationRef.current > 0 ? clamp01(ms / durationRef.current) : 0);
          setPendingSeekMs(null);
          setDragMs(ms);
        },
        onPanResponderMove: (event) => {
          if (!draggingRef.current) return;
          const ms = positionFromPageX(event.nativeEvent.pageX);
          progress.setValue(durationRef.current > 0 ? clamp01(ms / durationRef.current) : 0);
          setDragMs(ms);
        },
        onPanResponderRelease: (event) => {
          const ms = positionFromPageX(event.nativeEvent.pageX);
          draggingRef.current = false;
          setDragMs(null);
          setPendingSeekMs(ms);
          if (durationRef.current > 0) onSeekRef.current(ms);
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
          setDragMs(null);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [positionFromPageX, progress],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const layoutWidth = event.nativeEvent.layout.width;
    widthRef.current = layoutWidth;
    setWidth(layoutWidth);
    barRef.current?.measureInWindow((x) => {
      leftRef.current = x;
    });
  }

  function step(deltaMs: number) {
    if (durationMs <= 0) return;
    const next = Math.min(durationMs, Math.max(0, displayMs + deltaMs));
    onSeek(Math.round(next));
  }

  return (
    <View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(displayMs)}</Text>
        <Text style={styles.time}>{formatDuration(durationMs)}</Text>
      </View>
      <View
        ref={barRef}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
        style={styles.seeker}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        accessibilityValue={{
          min: 0,
          max: Math.round(durationMs),
          now: Math.round(displayMs),
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Seek forward' },
          { name: 'decrement', label: 'Seek backward' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') step(STEP_MS);
          else if (event.nativeEvent.actionName === 'decrement') step(-STEP_MS);
        }}
      >
        <View style={styles.track} pointerEvents="none">
          <Animated.View style={[styles.fill, { transform: [{ scaleX: progress }] }]} />
          {width > 0 ? (
            <Animated.View
              style={[
                styles.thumb,
                {
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, width - 6],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
        </View>
      </View>
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
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff1f',
  },
  fill: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  thumb: {
    position: 'absolute',
    top: -4,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
});
