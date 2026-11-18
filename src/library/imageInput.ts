import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { pickedImageFromAsset, type PickedImage } from '../lib/artworkInput';

export type { PickedImage } from '../lib/artworkInput';

export async function pickImageFromGallery(): Promise<PickedImage | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  return pickedImageFromAsset(asset);
}

export async function pickImageFromFiles(): Promise<PickedImage | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    copyToCacheDirectory: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  return pickedImageFromAsset({
    uri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType,
    fileSize: asset.size,
  });
}
