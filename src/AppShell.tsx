import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import type { Asset } from 'expo-media-library';
import { MiniPlayer } from './components/MiniPlayer';
import { DEMO_TRACKS } from './library/demo';
import { ensureAudioPermission, scanLibrary } from './library/scan';
import { usePlayer } from './player/PlayerProvider';
import { LibraryScreen } from './screens/LibraryScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { colors } from './theme';
import type { LibraryStatus, ScreenName, Track } from './types';

export function AppShell() {
  const { track: currentTrack, playTrack } = usePlayer();
  const [screen, setScreen] = useState<ScreenName>('library');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('scanning');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [scanId, setScanId] = useState(0);
  const assetsRef = useRef(new Map<string, Asset>());

  useEffect(() => {
    async function loadLibrary() {
      setStatus('scanning');
      setStatusNote(null);
      if (Platform.OS === 'web') {
        setTracks(DEMO_TRACKS);
        setStatus('ready');
        setStatusNote('Web preview — demo library');
        return;
      }
      try {
        if (!(await ensureAudioPermission())) {
          setTracks(DEMO_TRACKS);
          setStatus('denied');
          return;
        }
        const result = await scanLibrary();
        assetsRef.current = result.assets;
        if (result.tracks.length === 0) {
          setTracks(DEMO_TRACKS);
          setStatus('empty');
        } else {
          setTracks(result.tracks);
          setStatus('ready');
        }
      } catch {
        setTracks(DEMO_TRACKS);
        setStatus('error');
      }
    }
    void loadLibrary();
  }, [scanId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'nowPlaying' || screen === 'settings') {
        setScreen('library');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  async function handleSelect(track: Track) {
    const ok = await playTrack(
      track,
      async (t) => {
        const asset = assetsRef.current.get(t.id);
        if (!asset) throw new Error('missing asset');
        return asset.getUri();
      },
      tracks,
    );
    if (!ok) {
      if (currentTrack?.id !== track.id) setStatusNote('Could not play this file');
    } else {
      setStatusNote(null);
      setScreen('nowPlaying');
    }
  }

  return (
    <View style={styles.root}>
      <View
        style={styles.library}
        accessibilityElementsHidden={screen !== 'library'}
        importantForAccessibility={screen !== 'library' ? 'no-hide-descendants' : 'auto'}
      >
        <LibraryScreen
          tracks={tracks}
          status={status}
          statusNote={statusNote}
          onSelect={handleSelect}
          onOpenSettings={() => setScreen('settings')}
        />
      </View>
      {screen === 'library' ? (
        <MiniPlayer onExpand={() => setScreen('nowPlaying')} />
      ) : null}
      {screen === 'nowPlaying' && currentTrack ? (
        <NowPlayingScreen onClose={() => setScreen('library')} />
      ) : null}
      <SettingsScreen
        visible={screen === 'settings'}
        status={status}
        onRescan={() => setScanId((n) => n + 1)}
        onBack={() => setScreen('library')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  library: {
    flex: 1,
  },
});
