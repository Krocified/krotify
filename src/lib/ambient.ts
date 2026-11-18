import { coverColors } from './cover.ts';
import { hashString } from './hash.ts';

export type AmbientPool = {
  color: string;
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  durationMs: number;
  delayMs: number;
};

export type AmbientTheme = {
  base: string;
  top: string;
  bottom: string;
  pools: AmbientPool[];
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function channels(hex: string): [number, number, number] | null {
  if (!HEX.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');
}

export function adjustColor(hex: string, amount: number): string {
  const rgb = channels(hex);
  if (!rgb) return '#000000';
  const bounded = Math.min(1, Math.max(-1, amount));
  const [r, g, b] = rgb.map((channel) =>
    bounded >= 0 ? channel + (255 - channel) * bounded : channel + channel * bounded,
  ) as [number, number, number];
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function makeRandom(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function ambientTheme(input: {
  seed: string;
  coverColor: string | null;
  hue: number;
}): AmbientTheme {
  const fallback = coverColors(input.hue)[0];
  const base =
    input.coverColor && HEX.test(input.coverColor) ? input.coverColor : fallback;
  const random = makeRandom(input.seed);
  const pools: AmbientPool[] = Array.from({ length: 3 }, (_, index) => {
    const durationMs = 60000 + Math.floor(random() * 60000);
    return {
      color: adjustColor(base, index % 2 === 0 ? 0.25 : -0.25),
      size: 0.9 + random() * 0.7,
      x: random(),
      y: random(),
      driftX: (random() - 0.5) * 0.5,
      driftY: (random() - 0.5) * 0.5,
      durationMs,
      delayMs: Math.floor(random() * durationMs),
    };
  });
  return {
    base,
    top: adjustColor(base, 0.18),
    bottom: adjustColor(base, -0.55),
    pools,
  };
}
