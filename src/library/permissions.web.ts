import type { PermissionState } from '../lib/settingsView';

export async function readAudioPermissionState(): Promise<PermissionState> {
  return 'not-asked';
}

export async function grantAudioPermission(): Promise<PermissionState> {
  return 'not-asked';
}
