export const BLOB_LOOP_MS = 60 * 60 * 1000;

export type AmbientBlob = {
  x: number;
  y: number;
  size: number;
  colorIndex: 0 | 1;
  driftX: number;
  driftY: number;
  phase: number;
  fx: number;
  fy: number;
  fs: number;
  fo: number;
  opacity: number;
  scaleAmp: number;
};

export const AMBIENT_BLOBS: readonly AmbientBlob[] = [
  { x: 0.18, y: 0.24, size: 0.95, colorIndex: 0, driftX: 0.09, driftY: 0.07, phase: 0.0, fx: 300, fy: 240, fs: 120, fo: 180, opacity: 0.4, scaleAmp: 0.14 },
  { x: 0.62, y: 0.2, size: 0.72, colorIndex: 1, driftX: 0.07, driftY: 0.1, phase: 2.4, fx: 225, fy: 180, fs: 90, fo: 120, opacity: 0.34, scaleAmp: 0.08 },
  { x: 0.3, y: 0.76, size: 0.86, colorIndex: 0, driftX: 0.07, driftY: 0.06, phase: 5.1, fx: 150, fy: 300, fs: 120, fo: 240, opacity: 0.34, scaleAmp: 0.1 },
  { x: 0.86, y: 0.6, size: 0.58, colorIndex: 1, driftX: 0.09, driftY: 0.11, phase: 3.9, fx: 180, fy: 240, fs: 120, fo: 100, opacity: 0.28, scaleAmp: 0.15 },
];
