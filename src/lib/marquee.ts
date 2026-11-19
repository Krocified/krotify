export const MAX_MARQUEE_CHARS = 250;

export type MarqueeFit = {
  text: string;
  tooLong: boolean;
};

export function fitMarqueeText(text: string, max = MAX_MARQUEE_CHARS): MarqueeFit {
  if (text.length <= max) return { text, tooLong: false };
  return { text: text.slice(0, max), tooLong: true };
}
