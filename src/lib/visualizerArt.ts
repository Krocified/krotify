import type { VisualizerStyleName } from './visualizerStyle.ts';

export type WaveLayerConfig = {
  periods: number;
  amplitude: number;
  phase: number;
  strokeWidth: number;
  opacity: number;
};

export type SoundwaveLayerConfig = WaveLayerConfig & {
  fillOpacity: number;
};

export type ThreadLayerConfig = WaveLayerConfig & {
  dash: string;
};

export type BlobShapeConfig = {
  x: number;
  y: number;
  radius: number;
  colorIndex: number;
  opacity: number;
};

export const CURVE_LAYERS: readonly WaveLayerConfig[] = [
  { periods: 2, amplitude: 0.34, phase: 0, strokeWidth: 2.2, opacity: 0.5 },
  { periods: 4, amplitude: 0.22, phase: 1.4, strokeWidth: 1.8, opacity: 0.35 },
  { periods: 6, amplitude: 0.13, phase: 2.8, strokeWidth: 1.5, opacity: 0.25 },
];

export const SOUNDWAVE_LAYER: SoundwaveLayerConfig = {
  periods: 8,
  amplitude: 0.26,
  phase: 0.4,
  strokeWidth: 1.5,
  opacity: 0.85,
  fillOpacity: 0.55,
};

export const THREAD_LAYER: ThreadLayerConfig = {
  periods: 8,
  amplitude: 0.26,
  phase: 0.9,
  strokeWidth: 1.5,
  opacity: 0.85,
  dash: '110 78',
};

export const BLOB_COPIES = 3;

export const BLOB_SHAPES: readonly BlobShapeConfig[] = [
  { x: 0.18, y: 0.3, radius: 0.55, colorIndex: 0, opacity: 0.85 },
  { x: 0.52, y: 0.66, radius: 0.42, colorIndex: 1, opacity: 0.75 },
  { x: 0.78, y: 0.36, radius: 0.6, colorIndex: 0, opacity: 0.65 },
];

export const SHEEN_BAND = {
  y: 0.28,
  height: 0.44,
  opacity: 0.5,
};

export function wavePeriods(style: VisualizerStyleName): readonly number[] {
  switch (style) {
    case 'curves':
      return CURVE_LAYERS.map((layer) => layer.periods * 2);
    case 'soundwave':
      return [SOUNDWAVE_LAYER.periods];
    case 'thread':
      return [THREAD_LAYER.periods];
    default:
      return [];
  }
}
