import { hashString } from './hash.ts';

export const VISUALIZER_STYLES = ['curves', 'soundwave', 'blobs'] as const;

export type VisualizerStyleName = (typeof VISUALIZER_STYLES)[number];

export function pickVisualizerStyle(seed: string): VisualizerStyleName {
  return VISUALIZER_STYLES[hashString(seed) % VISUALIZER_STYLES.length];
}
