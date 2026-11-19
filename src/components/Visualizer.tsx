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
  Stop,
  Svg,
} from 'react-native-svg';
import { pickVisualizerStyle, type VisualizerStyleName } from '../lib/visualizerStyle';
import { mirroredPath, openSinePath, type WavePathInput } from '../lib/waveGeometry';
import {
  BLOB_COPIES,
  BLOB_SHAPES,
  CURVE_LAYERS,
  RIBBON_LAYERS,
  SOUNDWAVE_LAYER,
} from '../lib/visualizerArt';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  seed: string;
  colors: readonly [string, string];
  isPlaying: boolean;
  opacity?: number;
  styleName?: VisualizerStyleName;
};

type Size = { width: number; height: number };

type Geometry = {
  width: number;
  height: number;
  periodWidth: number;
  artWidth: number;
};

const BREATH_DURATION = 5200;
const BREATH_SCALE = 0.06;

const PLAYING_DURATIONS: Record<VisualizerStyleName, number> = {
  curves: 13000,
  soundwave: 11000,
  blobs: 16000,
  ribbons: 15000,
};

const waveInput = (
  geometry: Geometry,
  periods: number,
  amplitude: number,
  phase: number,
): WavePathInput => ({
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
  const d = mirroredPath(
    waveInput(
      geometry,
      SOUNDWAVE_LAYER.periods,
      SOUNDWAVE_LAYER.amplitude * geometry.height,
      SOUNDWAVE_LAYER.phase,
    ),
  );
  return (
    <>
      <Path d={d} fill={`url(#${gradientId})`} opacity={SOUNDWAVE_LAYER.fillOpacity} />
      <Path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={SOUNDWAVE_LAYER.strokeWidth}
        opacity={SOUNDWAVE_LAYER.opacity}
      />
    </>
  );
}

function RibbonsArt({
  geometry,
  colors,
}: {
  geometry: Geometry;
  colors: readonly [string, string];
}) {
  return (
    <>
      {RIBBON_LAYERS.map((layer, index) => (
        <Path
          key={index}
          d={openSinePath(
            waveInput(
              geometry,
              layer.periods,
              layer.amplitude * geometry.height,
              layer.phase,
            ),
          )}
          fill="none"
          stroke={colors[layer.colorIndex]}
          strokeWidth={layer.thickness * geometry.height}
          opacity={layer.opacity}
          transform={`translate(0 ${layer.offset * geometry.height})`}
        />
      ))}
    </>
  );
}

function BlobsArt({
  geometry,
  radialIds,
}: {
  geometry: Geometry;
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

export function Visualizer({
  seed,
  colors,
  isPlaying,
  opacity = 0.2,
  styleName,
}: Props): ReactElement {
  const reduceMotion = useReduceMotion();
  const style = styleName ?? pickVisualizerStyle(seed);
  const [size, setSize] = useState<Size | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `${uid}grad`;
  const radialIds: readonly [string, string] = [`${uid}radA`, `${uid}radB`];

  const drift = useSharedValue(0);
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
      cancelAnimation(breath);
      drift.value = 0;
      breath.value = 0;
      return undefined;
    }
    if (!isPlaying) {
      cancelAnimation(drift);
      cancelAnimation(breath);
      return undefined;
    }
    const duration = PLAYING_DURATIONS[style];
    const phase = drift.value % 1;
    drift.value = phase;
    drift.value = withRepeat(
      withTiming(1 + phase, { duration, easing: Easing.linear }),
      -1,
    );
    if (style === 'blobs') {
      cancelAnimation(breath);
      breath.value = withRepeat(withTiming(1, { duration: BREATH_DURATION }), -1, true);
    }
    return () => {
      cancelAnimation(drift);
      cancelAnimation(breath);
    };
  }, [breath, drift, isPlaying, reduceMotion, size, style]);

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

  return (
    <View pointerEvents="none" style={[styles.fill, { opacity }]} onLayout={handleLayout}>
      {size && size.width > 0 && size.height > 0 && (
        <Animated.View style={[styles.art, driftStyle, { width: artWidth }]}>
          <Svg width={artWidth} height={height} viewBox={`0 0 ${artWidth} ${height}`}>
            <Defs>
              {style !== 'blobs' && (
                <GradientDef id={gradientId} colors={colors} cycles={cycles} />
              )}
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
            {style === 'ribbons' && (
              <RibbonsArt geometry={geometry} colors={colors} />
            )}
            {style === 'blobs' && (
              <BlobsArt geometry={geometry} radialIds={radialIds} />
            )}
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
