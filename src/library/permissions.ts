import { Linking } from 'react-native';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';
import { permissionStateFromResponse, type PermissionState } from '../lib/settingsView';

export async function readAudioPermissionState(): Promise<PermissionState> {
  try {
    const response = await getPermissionsAsync(false, ['audio']);
    return permissionStateFromResponse(response);
  } catch {
    return 'not-asked';
  }
}

export async function grantAudioPermission(): Promise<PermissionState> {
  let last: PermissionState = 'not-asked';
  try {
    const current = await getPermissionsAsync(false, ['audio']);
    last = permissionStateFromResponse(current);
    if (last === 'granted') return last;
    if (!current.canAskAgain) {
      await Linking.openSettings();
      return last;
    }
    const response = await requestPermissionsAsync(false, ['audio']);
    last = permissionStateFromResponse(response);
    return last;
  } catch {
    return last;
  }
}
