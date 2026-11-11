import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Asset } from 'expo-media-library';
import { MiniPlayer } from './components/MiniPlayer';
import { DEMO_TRACKS } from './library/demo';
import { ensureAudioPermission, scanLibrary } from './library/scan';
import { usePlayer } from './player/PlayerProvider';
import { LibraryScreen } from './screens/LibraryScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { colors, type } from './theme';
import type { LibraryStatus, ScreenName, Track } from './types';

export function AppShell() {
  const { track, playTrack } = usePlayer();
  const [screen, setScreen] = useState<ScreenName>('library');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('scanning');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const assetsRef = useRef(new Map<string, Asset>());

  useEffect(() => {
    async function loadLibrary() {
      setStatus('scanning');
      setStatusNote(null);
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
  }, []);

  async function handleSelect(track: Track) {
    const ok = await playTrack(track, async (t) => {
      const asset = assetsRef.current.get(t.id);
      if (!asset) throw new Error('missing asset');
      return asset.getUri();
    });
    if (!ok) setStatusNote('Could not play this file');
    else {
      setStatusNote(null);
      setScreen('nowPlaying');
    }
  }

  if (screen === 'settings') {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Settings</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={styles.library}
        accessibilityElementsHidden={screen === 'nowPlaying'}
        importantForAccessibility={
          screen === 'nowPlaying' ? 'no-hide-descendants' : 'auto'
        }
      >
        <LibraryScreen
          tracks={tracks}
          status={status}
          statusNote={statusNote}
          onSelect={handleSelect}
          onOpenSettings={() => setScreen('settings')}
        />
      </View>
      {screen !== 'nowPlaying' ? (
        <MiniPlayer onExpand={() => setScreen('nowPlaying')} />
      ) : null}
      {screen === 'nowPlaying' && track ? (
        <NowPlayingScreen onClose={() => setScreen('library')} />
      ) : null}
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
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  placeholderText: {
    ...type.body,
    color: colors.text,
  },
});
