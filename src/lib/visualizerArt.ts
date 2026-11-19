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

export type BlobShapeConfig = {
  x: number;
  y: number;
  radius: number;
  colorIndex: number;
  opacity: number;
};

export type RibbonLayerConfig = {
  periods: number;
  amplitude: number;
  phase: number;
  thickness: number;
  offset: number;
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

export const BLOB_COPIES = 3;

export const BLOB_SHAPES: readonly BlobShapeConfig[] = [
  { x: 0.18, y: 0.3, radius: 0.55, colorIndex: 0, opacity: 0.85 },
  { x: 0.52, y: 0.66, radius: 0.42, colorIndex: 1, opacity: 0.75 },
  { x: 0.78, y: 0.36, radius: 0.6, colorIndex: 0, opacity: 0.65 },
];

export const RIBBON_LAYERS: readonly RibbonLayerConfig[] = [
  { periods: 4, amplitude: 0.26, phase: 0.2, thickness: 0.4, offset: -0.62, colorIndex: 1, opacity: 0.95 },
  { periods: 2, amplitude: 0.24, phase: 1.1, thickness: 0.34, offset: -0.36, colorIndex: 0, opacity: 0.95 },
  { periods: 4, amplitude: 0.22, phase: 2.0, thickness: 0.32, offset: -0.1, colorIndex: 1, opacity: 0.95 },
  { periods: 2, amplitude: 0.2, phase: 2.9, thickness: 0.32, offset: 0.16, colorIndex: 0, opacity: 0.95 },
  { periods: 4, amplitude: 0.24, phase: 3.8, thickness: 0.34, offset: 0.42, colorIndex: 1, opacity: 0.95 },
  { periods: 2, amplitude: 0.26, phase: 4.7, thickness: 0.4, offset: 0.68, colorIndex: 0, opacity: 0.95 },
];

export function wavePeriods(style: VisualizerStyleName): readonly number[] {
  switch (style) {
    case 'curves':
      return CURVE_LAYERS.map((layer) => layer.periods * 2);
    case 'soundwave':
      return [SOUNDWAVE_LAYER.periods];
    case 'ribbons':
      return RIBBON_LAYERS.map((layer) => layer.periods * 2);
    default:
      return [];
  }
}
