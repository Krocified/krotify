import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeLinkServerUrl } from './serverUrl.ts';

export { normalizeLinkServerUrl } from './serverUrl.ts';

export const LINK_SERVER_URL_KEY = 'krotify.linkServerUrl.v1';
export const LINK_SERVER_TOKEN_KEY = 'krotify.linkServerToken.v1';

export type LinkServerConfig = { url: string; token: string };

export function parseLinkServerConfig(
  url: string | null,
  token: string | null,
): LinkServerConfig {
  return {
    url: normalizeLinkServerUrl(url ?? '') ?? '',
    token: (token ?? '').trim(),
  };
}

export async function loadLinkServerConfig(): Promise<LinkServerConfig> {
  try {
    const [url, token] = await Promise.all([
      AsyncStorage.getItem(LINK_SERVER_URL_KEY),
      AsyncStorage.getItem(LINK_SERVER_TOKEN_KEY),
    ]);
    return parseLinkServerConfig(url, token);
  } catch {
    return { url: '', token: '' };
  }
}

export async function saveLinkServerConfig(config: LinkServerConfig): Promise<void> {
  await AsyncStorage.setItem(LINK_SERVER_URL_KEY, normalizeLinkServerUrl(config.url) ?? '');
  await AsyncStorage.setItem(LINK_SERVER_TOKEN_KEY, config.token.trim());
}
