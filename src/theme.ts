export const colors = {
  bg: '#0B0B0F',
  surface: '#16161D',
  surfaceHi: '#1F1F29',
  text: '#F5F5F7',
  textDim: '#9A9AA8',
  accent: '#215BED',
  accent2: '#6E9BFF',
} as const;

export const radius = { cover: 4, coverLarge: 8, screen: 16 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const type = {
  display: { fontSize: 30, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, fontWeight: '500' },
} as const;
