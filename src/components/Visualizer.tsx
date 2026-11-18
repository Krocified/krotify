import { useCallback, useEffect, useId, useState, type ReactElement } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';
import { pickVisualizerStyle, type VisualizerStyleName } from '../lib/visualizerStyle';
import { mirroredPath, openSinePath } from '../lib/waveGeometry';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  seed: string;
  colors: readonly [string, string];
  isPlaying: boolean;
  opacity?: number;
};

type Size = { width: number; height: number };

type Geometry = {
  width: number;
  height: number;
  periodWidth: number;
  artWidth: number;
};

const PAUSED_DURATION = 48000;
const BREATH_DURATION = 5200;
const BREATH_SCALE = 0.06;
const BLOB_COPIES = 3;

const PLAYING_DURATIONS: Record<VisualizerStyleName, number> = {
  curves: 13000,
  soundwave: 11000,
  sheen: 9000,
  blobs: 16000,
  thread: 14000,
};

const CURVE_LAYERS = [
  { periods: 2, amplitude: 0.34, phase: 0, strokeWidth: 2.2, opacity: 0.5 },
  { periods: 4, amplitude: 0.22, phase: 1.4, strokeWidth: 1.8, opacity: 0.35 },
  { periods: 6, amplitude: 0.13, phase: 2.8, strokeWidth: 1.5, opacity: 0.25 },
];

const BLOB_SHAPES = [
  { x: 0.18, y: 0.3, radius: 0.55, colorIndex: 0, opacity: 0.85 },
  { x: 0.52, y: 0.66, radius: 0.42, colorIndex: 1, opacity: 0.75 },
  { x: 0.78, y: 0.36, radius: 0.6, colorIndex: 0, opacity: 0.65 },
];

const waveInput = (
  geometry: Geometry,
  periods: number,
  amplitude: number,
  phase: number,
): { width: number; height: number; periods: number; amplitude: number; phase: number } => ({
  width: geometry.artWidth,
  height: geometry.height,
  periods,
  amplitude,
  phase,
});

function GradientDef({
  id,
  colors,
  cycles,
}: {
  id: string;
  colors: readonly [string, string];
  cycles: number;
}) {
  const steps = cycles * 2;
  return (
    <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
      {Array.from({ length: steps + 1 }, (_, index) => (
        <Stop key={index} offset={index / steps} stopColor={colors[index % 2]} />
      ))}
    </LinearGradient>
  );
}

function RadialDef({ id, color }: { id: string; color: string }) {
  return (
    <RadialGradient id={id} cx="50%" cy="50%" r="50%">
      <Stop offset="0" stopColor={color} stopOpacity={0.55} />
      <Stop offset="0.65" stopColor={color} stopOpacity={0.2} />
      <Stop offset="1" stopColor={color} stopOpacity={0} />
    </RadialGradient>
  );
}

function CurvesArt({ geometry, gradientId }: { geometry: Geometry; gradientId: string }) {
  return (
    <>
      {CURVE_LAYERS.map((layer, index) => (
        <Path
          key={index}
          d={openSinePath(
            waveInput(geometry, layer.periods * 2, layer.amplitude * geometry.height, layer.phase),
          )}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={layer.strokeWidth}
          opacity={layer.opacity}
        />
      ))}
    </>
  );
}

function SoundwaveArt({ geometry, gradientId }: { geometry: Geometry; gradientId: string }) {
  const d = mirroredPath(waveInput(geometry, 8, 0.26 * geometry.height, 0.4));
  return (
    <>
      <Path d={d} fill={`url(#${gradientId})`} opacity={0.55} />
      <Path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={1.5}
        opacity={0.85}
      />
    </>
  );
}

function SheenArt({ geometry, gradientId }: { geometry: Geometry; gradientId: string }) {
  return (
    <Rect
      x={0}
      y={0}
      width={geometry.artWidth}
      height={geometry.height}
      fill={`url(#${gradientId})`}
    />
  );
}

function SheenBand({ geometry, gradientId }: { geometry: Geometry; gradientId: string }) {
  return (
    <Rect
      x={0}
      y={0.28 * geometry.height}
      width={geometry.artWidth}
      height={0.44 * geometry.height}
      fill={`url(#${gradientId})`}
      opacity={0.5}
    />
  );
}

function BlobsArt({
  geometry,
  colors,
  radialIds,
}: {
  geometry: Geometry;
  colors: readonly [string, string];
  radialIds: readonly [string, string];
}) {
  return (
    <>
      {BLOB_SHAPES.map((blob, index) =>
        Array.from({ length: BLOB_COPIES }, (_, copy) => (
          <Circle
            key={`${index}-${copy}`}
            cx={blob.x * geometry.width + copy * geometry.width}
            cy={blob.y * geometry.height}
            r={blob.radius * geometry.height}
            fill={`url(#${radialIds[blob.colorIndex]})`}
            opacity={blob.opacity}
          />
        )),
      )}
    </>
  );
}

function ThreadArt({ geometry, gradientId }: { geometry: Geometry; gradientId: string }) {
  return (
    <Path
      d={openSinePath(waveInput(geometry, 8, 0.26 * geometry.height, 0.9))}
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth={1.5}
      strokeDasharray="110 78"
      opacity={0.85}
    />
  );
}

export function Visualizer({
  seed,
  colors,
  isPlaying,
  opacity = 0.2,
}: Props): ReactElement {
  const reduceMotion = useReduceMotion();
  const style = pickVisualizerStyle(seed);
  const [size, setSize] = useState<Size | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `${uid}grad`;
  const bandGradientId = `${uid}band`;
  const radialIds: readonly [string, string] = [`${uid}radA`, `${uid}radB`];

  const drift = useSharedValue(0);
  const counter = useSharedValue(0);
  const breath = useSharedValue(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);

  useEffect(() => {
    if (reduceMotion || !size) {
      cancelAnimation(drift);
      cancelAnimation(counter);
      cancelAnimation(breath);
      drift.value = 0;
      counter.value = 0;
      breath.value = 0;
      return undefined;
    }
    const duration = isPlaying ? PLAYING_DURATIONS[style] : PAUSED_DURATION;
    const phase = drift.value % 1;
    drift.value = phase;
    drift.value = withRepeat(
      withTiming(1 + phase, { duration, easing: Easing.linear }),
      -1,
    );
    if (style === 'sheen') {
      const bandPhase = counter.value % 1;
      counter.value = bandPhase;
      counter.value = withRepeat(
        withTiming(1 + bandPhase, { duration, easing: Easing.linear }),
        -1,
      );
    }
    if (style === 'blobs') {
      cancelAnimation(breath);
      breath.value = withRepeat(withTiming(1, { duration: BREATH_DURATION }), -1, true);
    }
    return () => {
      cancelAnimation(drift);
      cancelAnimation(counter);
      cancelAnimation(breath);
    };
  }, [breath, counter, drift, isPlaying, reduceMotion, size, style]);

  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const periodWidth = style === 'blobs' ? width : width / 2;
  const artWidth = width + periodWidth * 2;
  const geometry: Geometry = { width, height, periodWidth, artWidth };
  const cycles = artWidth / periodWidth;

  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -drift.value * periodWidth },
      { scaleY: style === 'blobs' ? 1 + breath.value * BREATH_SCALE : 1 },
    ],
  }));

  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (counter.value - 2) * periodWidth }],
  }));

  return (
    <View pointerEvents="none" style={[styles.fill, { opacity }]} onLayout={handleLayout}>
      {size && size.width > 0 && size.height > 0 && (
        <Animated.View style={[styles.art, driftStyle, { width: artWidth }]}>
          <Svg width={artWidth} height={height} viewBox={`0 0 ${artWidth} ${height}`}>
            <Defs>
              <GradientDef id={gradientId} colors={colors} cycles={cycles} />
              {style === 'blobs' && (
                <>
                  <RadialDef id={radialIds[0]} color={colors[0]} />
                  <RadialDef id={radialIds[1]} color={colors[1]} />
                </>
              )}
            </Defs>
            {style === 'curves' && <CurvesArt geometry={geometry} gradientId={gradientId} />}
            {style === 'soundwave' && (
              <SoundwaveArt geometry={geometry} gradientId={gradientId} />
            )}
            {style === 'sheen' && <SheenArt geometry={geometry} gradientId={gradientId} />}
            {style === 'blobs' && (
              <BlobsArt geometry={geometry} colors={colors} radialIds={radialIds} />
            )}
            {style === 'thread' && <ThreadArt geometry={geometry} gradientId={gradientId} />}
          </Svg>
        </Animated.View>
      )}
      {size && size.width > 0 && size.height > 0 && style === 'sheen' && (
        <Animated.View style={[styles.art, counterStyle, { width: artWidth }]}>
          <Svg width={artWidth} height={height} viewBox={`0 0 ${artWidth} ${height}`}>
            <Defs>
              <GradientDef id={bandGradientId} colors={colors} cycles={cycles} />
            </Defs>
            <SheenBand geometry={geometry} gradientId={bandGradientId} />
          </Svg>
        </Animated.View>
      )}
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
  art: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
