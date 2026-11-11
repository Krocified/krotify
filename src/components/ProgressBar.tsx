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
  resetToken?: number;
};

const STEP_MS = 10_000;
const GLIDE_MS = 500;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function ProgressBar({ positionMs, durationMs, onSeek, resetToken = 0 }: Props) {
  const [width, setWidth] = useState(0);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const [pendingSeek, setPendingSeek] = useState<{ ms: number; duration: number } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [justReset, setJustReset] = useState(false);
  const lastResetRef = useRef(resetToken);
  const barRef = useRef<ComponentRef<typeof View>>(null);
  const leftRef = useRef(0);
  const widthRef = useRef(0);
  const durationRef = useRef(durationMs);
  const draggingRef = useRef(false);
  const onSeekRef = useRef(onSeek);
  const [progress] = useState(() =>
    new Animated.Value(durationMs > 0 ? clamp01(positionMs / durationMs) : 0),
  );

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
  }, []);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    if (lastResetRef.current === resetToken) return;
    lastResetRef.current = resetToken;
    progress.stopAnimation();
    progress.setValue(0);
    setDragMs(null);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    setPendingSeek(null);
    setJustReset(true);
    const timer = setTimeout(() => setJustReset(false), 600);
    return () => clearTimeout(timer);
  }, [resetToken, progress]);

  const basePosition = justReset && positionMs > 1500 ? 0 : positionMs;
  const pendingVisible =
    pendingSeek !== null &&
    pendingSeek.duration === durationMs &&
    Math.abs(basePosition - pendingSeek.ms) > 1500;
  const displayMs = dragMs ?? (pendingVisible ? pendingSeek.ms : null) ?? basePosition;
  const dragging = dragMs !== null;
  const thumbSize = dragging ? 20 : 14;

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
          if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
          setPendingSeek(null);
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
          if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
          setPendingSeek({ ms, duration: durationRef.current });
          pendingTimerRef.current = setTimeout(() => setPendingSeek(null), 800);
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
        <View style={[styles.track, dragging && styles.trackActive]} pointerEvents="none">
          <Animated.View
            style={[styles.fill, dragging && styles.fillActive, { transform: [{ scaleX: progress }] }]}
          />
          {width > 0 ? (
            <Animated.View
              style={[
                styles.thumb,
                dragging && styles.thumbActive,
                {
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-thumbSize / 2, width - thumbSize / 2],
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
    backgroundColor: '#ffffff33',
  },
  trackActive: {
    height: 6,
    borderRadius: 3,
  },
  fill: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentBright,
    transformOrigin: 'left',
  },
  fillActive: {
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: -5,
    left: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  thumbActive: {
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
