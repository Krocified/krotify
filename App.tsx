import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppShell } from './src/AppShell';
import { PlayerProvider } from './src/player/PlayerProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <AppShell />
      </PlayerProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
