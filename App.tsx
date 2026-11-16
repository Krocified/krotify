import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppShell } from './src/AppShell';
import { FavoritesProvider } from './src/library/FavoritesProvider';
import { PlayerProvider } from './src/player/PlayerProvider';
import { TagProvider } from './src/tags/TagProvider';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PlayerProvider>
          <FavoritesProvider>
            <TagProvider>
              <AppShell />
            </TagProvider>
          </FavoritesProvider>
        </PlayerProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
