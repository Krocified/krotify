import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import type { Asset } from 'expo-media-library';
import { MiniPlayer } from './components/MiniPlayer';
import { TabBar, type TabName } from './components/TabBar';
import { DEMO_TRACKS } from './library/demo';
import { excludeTrack, loadExcludedTracks, restoreTrack } from './library/exclusions';
import {
  deleteImportedFile,
  loadImportedTracks,
  pickAndImportTracks,
  removeImportedTrack,
} from './library/imports';
import { ensureAudioPermission, scanLibrary } from './library/scan';
import { mergeLibrary } from './lib/library';
import { enrichTracks } from './library/metadata';
import { listFavoriteIds, listRecentTrackIds, recordPlay } from './db/repo';
import { usePlayer } from './player/PlayerProvider';
import { AlbumsScreen } from './screens/AlbumsScreen';
import { ArtistsScreen } from './screens/ArtistsScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { colors } from './theme';
import type { LibraryStatus, ScreenName, Track } from './types';

export function AppShell() {
  const { track: currentTrack, playTrack, stop, removeFromQueue, setQueue } = usePlayer();
  const [screen, setScreen] = useState<ScreenName>('library');
  const [tab, setTab] = useState<TabName>('library');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Track[]>([]);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<LibraryStatus>('scanning');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [scanId, setScanId] = useState(0);
  const assetsRef = useRef(new Map<string, Asset>());
  const closeNowPlayingRef = useRef<(() => void) | null>(null);
  const returnScreenRef = useRef<ScreenName>('library');
  const settingsReturnRef = useRef<ScreenName>('library');
  const searchReturnRef = useRef<ScreenName>('library');
  const registerClose = useCallback((close: (() => void) | null) => {
    closeNowPlayingRef.current = close;
  }, []);

  const refreshRecent = useCallback(() => {
    void listRecentTrackIds(20)
      .then((ids) => setRecentTrackIds(ids))
      .catch(() => {});
  }, []);

  const recentTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return recentTrackIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => track !== undefined);
  }, [recentTrackIds, tracks]);

  useEffect(() => {
    async function loadLibrary() {
      setStatus('scanning');
      setStatusNote(null);
      void Promise.all([listFavoriteIds(), listRecentTrackIds()])
        .then(([favorites, recent]) => {
          setFavoriteIds(favorites);
          setRecentTrackIds(recent);
        })
        .catch(() => {});

      function enrich(initial: Track[]) {
        const targets = initial.filter((track) => track.source !== 'demo');
        if (targets.length === 0) return;
        void enrichTracks(
          targets,
          async (track) =>
            track.source === 'import'
              ? track.uri
              : (assetsRef.current.get(track.id)?.getUri() ?? null),
          (batch) => {
            const byId = new Map(batch.map((track) => [track.id, track]));
            setTracks((prev) => prev.map((track) => byId.get(track.id) ?? track));
          },
        ).catch(() => {});
      }

      if (Platform.OS === 'web') {
        const [, excludedTracks] = await Promise.all([
          loadImportedTracks(),
          loadExcludedTracks(),
        ]);
        setExcluded(excludedTracks);
        setTracks(DEMO_TRACKS);
        setStatus('ready');
        setStatusNote('Web preview: demo library');
        return;
      }
      let importedTracks: Track[] = [];
      let excludedTracks: Track[] = [];
      try {
        const [granted, loadedImported, loadedExcluded] = await Promise.all([
          ensureAudioPermission(),
          loadImportedTracks(),
          loadExcludedTracks(),
        ]);
        importedTracks = loadedImported;
        excludedTracks = loadedExcluded;
        setExcluded(excludedTracks);
        const excludedIds = new Set(excludedTracks.map((track) => track.id));
        const importOnly = mergeLibrary([], importedTracks, excludedIds);

        if (!granted) {
          setTracks(importOnly.length > 0 ? importOnly : DEMO_TRACKS);
          enrich(importOnly);
          setStatus('denied');
          if (importOnly.length > 0) {
            setStatusNote('Audio permission denied. Showing imported tracks.');
          }
          return;
        }
        const result = await scanLibrary();
        assetsRef.current = result.assets;
        const merged = mergeLibrary(result.tracks, importedTracks, excludedIds);
        if (merged.length === 0) {
          setTracks(importOnly.length > 0 ? importOnly : DEMO_TRACKS);
          enrich(importOnly);
          setStatus('empty');
        } else {
          setTracks(merged);
          enrich(merged);
          setStatus('ready');
        }
      } catch {
        const importOnly = mergeLibrary([], importedTracks, new Set(excludedTracks.map((track) => track.id)));
        setTracks(importOnly.length > 0 ? importOnly : DEMO_TRACKS);
        enrich(importOnly);
        setStatus('error');
      }
    }
    void loadLibrary();
  }, [scanId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'nowPlaying') {
        if (closeNowPlayingRef.current) closeNowPlayingRef.current();
        else setScreen(returnScreenRef.current);
        return true;
      }
      if (screen === 'settings') {
        setScreen(settingsReturnRef.current);
        return true;
      }
      if (screen === 'search') {
        setScreen(searchReturnRef.current);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, tab]);

  useEffect(() => {
    if (screen === 'library') refreshRecent();
  }, [screen, refreshRecent]);

  const handleArtworkLoaded = useCallback((trackId: string, uri: string) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId && !track.artworkUri ? { ...track, artworkUri: uri } : track,
      ),
    );
  }, []);

  function rememberReturnScreen() {
    returnScreenRef.current = screen === 'search' ? tab : screen;
  }

  async function handleSelect(track: Track, queue?: Track[]) {
    if (currentTrack?.id === track.id) {
      setQueue(queue ?? tracks);
      rememberReturnScreen();
      setScreen('nowPlaying');
      return;
    }
    const ok = await playTrack(
      track,
      async (t) => {
        if (t.source === 'import') return t.uri;
        const asset = assetsRef.current.get(t.id);
        if (!asset) throw new Error('missing asset');
        return asset.getUri();
      },
      queue ?? tracks,
    );
    if (!ok) {
      if (currentTrack?.id !== track.id) setStatusNote('Could not play this file');
    } else {
      setStatusNote(null);
      void recordPlay(track.id).then(refreshRecent).catch(() => {});
      rememberReturnScreen();
      setScreen('nowPlaying');
    }
  }

  async function hideTrack(track: Track) {
    const next = await excludeTrack(track);
    setExcluded(next);
    setTracks((prev) => prev.filter((item) => item.id !== track.id));
    removeFromQueue([track.id]);
    setStatusNote(null);
  }

  async function deleteTrack(track: Track) {
    try {
      if (track.source === 'scan') {
        await assetsRef.current.get(track.id)?.delete();
      } else if (track.source === 'import') {
        await deleteImportedFile(track.uri);
        await removeImportedTrack(track.id);
      }
    } catch {
      setStatusNote('Could not delete this file');
      return;
    }
    const nextExcluded = await restoreTrack(track.id);
    setExcluded(nextExcluded);
    setTracks((prev) => prev.filter((item) => item.id !== track.id));
    removeFromQueue([track.id]);
    setStatusNote(null);
    if (currentTrack?.id === track.id) stop();
  }

  function confirmDelete(track: Track) {
    Alert.alert(
      'Delete track?',
      `"${track.title}" will be removed from this device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteTrack(track) },
      ],
    );
  }

  function handleManage(track: Track) {
    if (track.source === 'demo') return;
    if (Platform.OS === 'web') {
      const remove = window.confirm(`Delete "${track.title}"? Cancel hides it instead.`);
      void (remove ? deleteTrack(track) : hideTrack(track));
      return;
    }
    Alert.alert(track.title, undefined, [
      { text: 'Exclude', onPress: () => void hideTrack(track) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(track) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleImport() {
    if (Platform.OS === 'web') return;
    setImporting(true);
    try {
      const added = await pickAndImportTracks();
      if (added.length === 0) return;
      setTracks((prev) =>
        mergeLibrary(
          prev.filter((item) => item.source !== 'demo'),
          added,
          new Set(excluded.map((item) => item.id)),
        ),
      );
      setStatus('ready');
      setStatusNote(null);
    } finally {
      setImporting(false);
    }
  }

  async function handleRestore(id: string) {
    const track = excluded.find((item) => item.id === id);
    const next = await restoreTrack(id);
    setExcluded(next);
    if (track) {
      setTracks((prev) =>
        mergeLibrary(prev, [track], new Set(next.map((item) => item.id))),
      );
      setStatus('ready');
      setStatusNote(null);
    }
  }

  const showTabs = screen === 'library' || screen === 'albums' || screen === 'artists';
  const showTabBar = screen !== 'nowPlaying' && screen !== 'search';
  const activeTab: TabName = showTabs ? screen : tab;

  function openSearch() {
    searchReturnRef.current = activeTab;
    setScreen('search');
  }

  function openSettings() {
    settingsReturnRef.current = activeTab;
    setScreen('settings');
  }

  function selectTab(next: TabName) {
    setTab(next);
    setScreen(next);
  }

  return (
    <View style={styles.root}>
      <View
        style={styles.library}
        accessibilityElementsHidden={!showTabs}
        importantForAccessibility={showTabs ? 'auto' : 'no-hide-descendants'}
      >
        {activeTab === 'library' ? (
          <LibraryScreen
            tracks={tracks}
            recentTracks={recentTracks}
            status={status}
            statusNote={statusNote}
            onSelect={handleSelect}
            onManage={handleManage}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        ) : activeTab === 'albums' ? (
          <AlbumsScreen
            tracks={tracks}
            onSelect={handleSelect}
            onArtworkLoaded={handleArtworkLoaded}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        ) : (
          <ArtistsScreen
            tracks={tracks}
            onSelect={handleSelect}
            onArtworkLoaded={handleArtworkLoaded}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        )}
      </View>
      {screen === 'nowPlaying' && currentTrack ? (
        <NowPlayingScreen
          onClose={() => setScreen(returnScreenRef.current)}
          registerClose={registerClose}
        />
      ) : null}
      <SearchScreen
        visible={screen === 'search'}
        tracks={tracks}
        onSelect={handleSelect}
        onBack={() => setScreen(searchReturnRef.current)}
      />
      <SettingsScreen
        visible={screen === 'settings'}
        status={status}
        onRescan={() => setScanId((n) => n + 1)}
        onBack={() => setScreen(settingsReturnRef.current)}
        onImport={() => void handleImport()}
        excluded={excluded}
        onRestore={(id) => void handleRestore(id)}
        importing={importing}
      />
      {showTabBar ? (
        <View style={styles.bottom}>
          <View style={styles.miniPlayer}>
            <MiniPlayer
              onExpand={() => {
                rememberReturnScreen();
                setScreen('nowPlaying');
              }}
            />
          </View>
          <View style={styles.tabBar}>
            <TabBar active={activeTab} onSelect={selectTab} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  library: {
    flex: 1,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  miniPlayer: {
    zIndex: 2,
    elevation: 2,
  },
  tabBar: {
    zIndex: 1,
  },
});
