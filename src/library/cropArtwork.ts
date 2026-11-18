import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CropRect } from '../lib/crop';

export type CropSource = {
  uri: string;
  width: number;
  height: number;
};

export async function normalizeCropSource(uri: string): Promise<CropSource> {
  const image = await ImageManipulator.manipulate(uri).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
  return { uri: saved.uri, width: image.width, height: image.height };
}

export async function cropSquare(uri: string, rect: CropRect): Promise<File> {
  const context = ImageManipulator.manipulate(uri);
  context.crop(rect);
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return new File(result.uri);
}
