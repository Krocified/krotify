import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { pickedImageFromAsset, type PickedImage } from '../lib/artworkInput';

export type { PickedImage } from '../lib/artworkInput';

function withSize(picked: PickedImage): PickedImage {
  if (picked.sizeBytes > 0) return picked;
  try {
    const size = new File(picked.uri).size;
    if (Number.isFinite(size) && size > 0) return { ...picked, sizeBytes: size };
  } catch {}
  return picked;
}

export async function pickImageFromGallery(): Promise<PickedImage | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  return withSize(pickedImageFromAsset(asset));
}

export async function pickImageFromFiles(): Promise<PickedImage | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    copyToCacheDirectory: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  return withSize(
    pickedImageFromAsset({
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType,
      fileSize: asset.size,
    }),
  );
}
