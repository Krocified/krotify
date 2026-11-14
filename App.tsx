import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppShell } from './src/AppShell';
import { FavoritesProvider } from './src/library/FavoritesProvider';
import { PlayerProvider } from './src/player/PlayerProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <FavoritesProvider>
          <AppShell />
        </FavoritesProvider>
      </PlayerProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
