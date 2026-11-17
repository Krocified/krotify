import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CropRect } from '../lib/crop';

export async function cropSquare(uri: string, rect: CropRect): Promise<File> {
  const context = ImageManipulator.manipulate(uri);
  context.crop(rect);
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return new File(result.uri);
}
