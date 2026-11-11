function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const channel = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(channel(p, q, h + 1 / 3))}${toHex(channel(p, q, h))}${toHex(channel(p, q, h - 1 / 3))}`;
}

export function coverColors(hue: number): readonly [string, string] {
  return [hslToHex(hue, 62, 42), hslToHex(hue + 38, 72, 28)];
}

export function coverInitial(title: string): string {
  const match = title.match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : '?';
}
