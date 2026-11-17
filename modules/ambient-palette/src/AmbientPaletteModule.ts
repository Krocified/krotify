import { requireOptionalNativeModule } from 'expo-modules-core';

export type AmbientPaletteNativeModule = {
  dominantColor(uri: string): Promise<string | null>;
};

export default requireOptionalNativeModule<AmbientPaletteNativeModule>('AmbientPalette');
