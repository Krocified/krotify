export type TechStackItem = {
  concern: string;
  choice: string;
  why: string;
};

export const TECH_STACK: readonly TechStackItem[] = [
  {
    concern: 'Platform',
    choice: 'Android (APK)',
    why: "User's device; local file access is native territory",
  },
  {
    concern: 'Framework',
    choice: 'React Native via Expo (dev build)',
    why: 'Fast UI iteration; ships an APK',
  },
  {
    concern: 'Language',
    choice: 'TypeScript',
    why: 'Default for Expo templates',
  },
  {
    concern: 'Scan',
    choice: 'expo-media-library',
    why: 'Reads every device audio file + permissions',
  },
  {
    concern: 'Import',
    choice: 'expo-document-picker',
    why: 'Real provider filename, MIME and size; File.pickFileAsync returns document ids',
  },
  {
    concern: 'File ops',
    choice: 'expo-file-system',
    why: 'Delete, copy imported files',
  },
  {
    concern: 'Playlist reorder',
    choice: 'react-native-sortables with Reanimated 4, Worklets and Gesture Handler',
    why: 'Drag rows with auto-scroll and persisted order',
  },
  {
    concern: 'Playback',
    choice: 'expo-audio (all versions)',
    why: 'Ships background playback + lock-screen/notification controls itself',
  },
  {
    concern: 'Metadata/art',
    choice: 'react-native-metadata-retriever (v2)',
    why: 'ID3 tags + embedded cover art',
  },
  {
    concern: 'Persistence',
    choice: 'AsyncStorage in v1, expo-sqlite in v2',
    why: 'v1: imported tracks, exclusions. v2: playlists, favorites, history',
  },
  {
    concern: 'Visuals',
    choice:
      'expo-linear-gradient, expo-blur, react-native-safe-area-context, RN Animated',
    why: 'Gradients, glass pill, insets, motion',
  },
];
