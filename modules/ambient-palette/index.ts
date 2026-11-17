import AmbientPaletteModule from './src/AmbientPaletteModule';

export type { AmbientPaletteNativeModule } from './src/AmbientPaletteModule';

export async function dominantColor(uri: string): Promise<string | null> {
  return (await AmbientPaletteModule?.dominantColor(uri)) ?? null;
}

export default AmbientPaletteModule;
