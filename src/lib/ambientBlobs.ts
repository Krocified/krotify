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
  { x: 0.12, y: 0.18, size: 0.95, colorIndex: 0, driftX: 0.09, driftY: 0.07, phase: 0.0, fx: 300, fy: 240, fs: 120, fo: 180, opacity: 0.42, scaleAmp: 0.14 },
  { x: 0.74, y: 0.12, size: 0.62, colorIndex: 1, driftX: 0.07, driftY: 0.1, phase: 1.1, fx: 240, fy: 300, fs: 100, fo: 150, opacity: 0.36, scaleAmp: 0.1 },
  { x: 0.42, y: 0.34, size: 1.15, colorIndex: 1, driftX: 0.06, driftY: 0.05, phase: 2.4, fx: 225, fy: 180, fs: 90, fo: 120, opacity: 0.3, scaleAmp: 0.08 },
  { x: 0.88, y: 0.44, size: 0.7, colorIndex: 0, driftX: 0.1, driftY: 0.08, phase: 3.3, fx: 200, fy: 150, fs: 150, fo: 200, opacity: 0.34, scaleAmp: 0.12 },
  { x: 0.08, y: 0.62, size: 0.8, colorIndex: 1, driftX: 0.08, driftY: 0.09, phase: 4.2, fx: 180, fy: 225, fs: 80, fo: 100, opacity: 0.32, scaleAmp: 0.16 },
  { x: 0.58, y: 0.72, size: 1.0, colorIndex: 0, driftX: 0.07, driftY: 0.06, phase: 5.1, fx: 150, fy: 300, fs: 120, fo: 240, opacity: 0.38, scaleAmp: 0.1 },
  { x: 0.32, y: 0.9, size: 0.55, colorIndex: 0, driftX: 0.11, driftY: 0.07, phase: 0.7, fx: 300, fy: 200, fs: 100, fo: 180, opacity: 0.3, scaleAmp: 0.14 },
  { x: 0.96, y: 0.78, size: 0.86, colorIndex: 1, driftX: 0.06, driftY: 0.1, phase: 1.8, fx: 225, fy: 180, fs: 150, fo: 200, opacity: 0.34, scaleAmp: 0.09 },
  { x: -0.04, y: 0.36, size: 0.5, colorIndex: 0, driftX: 0.12, driftY: 0.08, phase: 2.9, fx: 240, fy: 120, fs: 90, fo: 150, opacity: 0.28, scaleAmp: 0.12 },
  { x: 0.66, y: 0.54, size: 0.48, colorIndex: 1, driftX: 0.09, driftY: 0.11, phase: 3.9, fx: 180, fy: 240, fs: 120, fo: 100, opacity: 0.26, scaleAmp: 0.15 },
  { x: 0.2, y: 0.02, size: 0.58, colorIndex: 1, driftX: 0.1, driftY: 0.06, phase: 4.8, fx: 200, fy: 225, fs: 150, fo: 240, opacity: 0.32, scaleAmp: 0.11 },
  { x: 0.52, y: 0.06, size: 0.42, colorIndex: 0, driftX: 0.13, driftY: 0.07, phase: 5.7, fx: 300, fy: 150, fs: 120, fo: 180, opacity: 0.28, scaleAmp: 0.13 },
];
