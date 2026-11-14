import AsyncStorage from '@react-native-async-storage/async-storage';

const NETWORK_KEY = 'krotify.lyrics.network.v1';

export async function loadLyricsNetworkEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NETWORK_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export async function saveLyricsNetworkEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NETWORK_KEY, enabled ? '1' : '0');
  } catch {
  }
}
