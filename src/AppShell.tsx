import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurTargetView } from 'expo-blur';
import type { ComponentRef } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Asset } from 'expo-media-library';
import { ConfirmSheet } from './components/ConfirmSheet';
import { MiniPlayer } from './components/MiniPlayer';
import { Sheet } from './components/Sheet';
import { TabBar, type TabName } from './components/TabBar';
import { Toast } from './components/Toast';
import {
  PlaylistPickerSheet,
  TrackActionsSheet,
} from './components/TrackActionsSheet';
import { listPlaylists, listRecentTrackIds, recordPlay, type Playlist } from './db/repo';
import { pickAndImportTracks, type ImportFailure } from './imports/local';
import { DEMO_TRACKS } from './library/demo';
import { useFavorites } from './library/FavoritesProvider';
import { resolvePlaybackUri } from './library/playbackSource';
import { ensureAudioPermission, scanLibrary } from './library/scan';
import { readScanPref, saveScanPref } from './library/scanPrefs';
import { resolveBack } from './lib/backIntent';
import { mergeLibrary, sortTracks } from './lib/library';
import { importResultMessage } from './lib/importResult';
import { parseResume, serializeResume } from './lib/resume';
import { isMissingTrack } from './lib/settingsView';
import { usePlayer } from './player/PlayerProvider';
import { getStorageRoot } from './storage/root';
import { filterTracksByTag, reconcileTagFilter } from './tags/filter';
import { useTags } from './tags/TagProvider';
import { clearTrack, deleteTrackEverywhere } from './tracks/actions';
import { listActiveTracks, listHiddenTracks, setTrackStatus } from './tracks/repo';
import { syncScanResults } from './tracks/scanSync';
import { toUiTrack } from './tracks/view';
import {
  EditTrackScreen,
  type EditTrackMode,
} from './screens/EditTrackScreen';
import { HiddenTracksScreen } from './screens/HiddenTracksScreen';
import { ImportScreen } from './screens/ImportScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { LikedScreen } from './screens/LikedScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { PlaylistsScreen } from './screens/PlaylistsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { colors, radius, space, type } from './theme';
import type { LibraryStatus, ScreenName, Track } from './types';

const RESUME_KEY = 'krotify.resume.v1';
const EXIT_WINDOW_MS = 2000;

type EditTarget = { track: Track; mode: EditTrackMode };

export function AppShell() {
  const {
    track: currentTrack,
    isPlaying,
    positionMs,
    lastError,
    playTrack,
    restore,
    stop,
    removeFromQueue,
    setQueue,
  } = usePlayer();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const { tags, assignments, refresh: refreshTags } = useTags();
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenName>('library');
  const [tab, setTab] = useState<TabName>('library');
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('scanning');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [scanId, setScanId] = useState(0);
  const [scanEnabled, setScanEnabled] = useState<boolean | null>(null);
  const [scanPrefLoaded, setScanPrefLoaded] = useState(false);
  const [scanPrompt, setScanPrompt] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [likedOpen, setLikedOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState<Track | null>(null);
  const [clearTarget, setClearTarget] = useState<Track | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);
  const [excludeAllConfirm, setExcludeAllConfirm] = useState(false);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const assetsRef = useRef(new Map<string, Asset>());
  const blurTargetRef = useRef<ComponentRef<typeof View> | null>(null);
  const closeNowPlayingRef = useRef<(() => void) | null>(null);
  const backInterceptorRef = useRef<(() => boolean) | null>(null);
  const exitArmedRef = useRef<number | null>(null);
  const screenRef = useRef<ScreenName>('library');
  const tabRef = useRef<TabName>('library');
  const editOpenRef = useRef(false);
  const likedOpenRef = useRef(false);
  const playlistsOpenRef = useRef(false);
  const openPlaylistIdRef = useRef<string | null>(null);
  const returnScreenRef = useRef<ScreenName>('library');
  const settingsReturnRef = useRef<ScreenName>('library');
  const searchReturnRef = useRef<ScreenName>('library');
  const resumedRef = useRef(false);
  const lastPositionRef = useRef<{ trackId: string; positionMs: number } | null>(null);
  const resumeSnapshotRef = useRef<{ trackId: string; positionMs: number } | null>(null);
  const wasPlayingRef = useRef(false);
  const registerClose = useCallback((close: (() => void) | null) => {
    closeNowPlayingRef.current = close;
  }, []);
  const registerBackInterceptor = useCallback(
    (handler: (() => boolean) | null) => {
      backInterceptorRef.current = handler;
    },
    [],
  );
  const showToast = useCallback(
    (message: string) => setToast({ id: Date.now(), message }),
    [],
  );

  const excludedIds = useMemo(() => new Set(excluded.map((track) => track.id)), [excluded]);
  const tracks = useMemo(
    () => sortTracks(libraryTracks.filter((track) => !excludedIds.has(track.id))),
    [libraryTracks, excludedIds],
  );
  useEffect(() => {
    setSelectedTagId((current) => reconcileTagFilter(current, tags));
  }, [tags]);
  const filteredTracks = useMemo(
    () => filterTracksByTag(tracks, selectedTagId, assignments),
    [tracks, selectedTagId, assignments],
  );
  const hiddenScannedCount = useMemo(
    () => excluded.filter((track) => track.source === 'scan').length,
    [excluded],
  );
  const hiddenNote =
    hiddenScannedCount > 0
      ? `${hiddenScannedCount} scanned track${hiddenScannedCount === 1 ? '' : 's'} hidden. Restore them in Settings.`
      : null;
  const favoriteCount = useMemo(
    () => tracks.filter((track) => favoriteIds.has(track.id)).length,
    [favoriteIds, tracks],
  );
  const scanExcludeCount = useMemo(
    () =>
      libraryTracks.filter(
        (track) => track.source === 'scan' && !excludedIds.has(track.id),
      ).length,
    [excludedIds, libraryTracks],
  );

  const refreshPlaylists = useCallback(() => {
    void listPlaylists()
      .then((items) => setPlaylists(items))
      .catch(() => {});
  }, []);

  const refreshRecent = useCallback(() => {
    void listRecentTrackIds(20)
      .then((ids) => setRecentTrackIds(ids))
      .catch(() => {});
  }, []);

  const refreshLibraryFromDb = useCallback(async () => {
    const [active, hidden] = await Promise.all([listActiveTracks(), listHiddenTracks()]);
    setLibraryTracks(active.map(toUiTrack));
    setExcluded(hidden.map(toUiTrack));
    void refreshTags();
  }, [refreshTags]);

  const recentTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return recentTrackIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => track !== undefined);
  }, [recentTrackIds, tracks]);
  useEffect(() => {
    refreshPlaylists();
  }, [refreshPlaylists]);

  useEffect(() => {
    let cancelled = false;
    void readScanPref()
      .then((pref) => {
        if (cancelled) return;
        setScanEnabled(pref);
        setScanPrefLoaded(true);
        if (pref === null) setScanPrompt(true);
      })
      .catch(() => {
        if (cancelled) return;
        setScanEnabled(false);
        setScanPrefLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scanPrefLoaded) return;
    let cancelled = false;

    async function loadLibrary() {
      setStatus('scanning');
      setStatusNote(null);
      void listRecentTrackIds()
        .then((recent) => {
          if (!cancelled) setRecentTrackIds(recent);
        })
        .catch(() => {});

      let active: Track[] = [];
      try {
        const [activeRows, hiddenRows] = await Promise.all([
          listActiveTracks(),
          listHiddenTracks(),
        ]);
        if (cancelled) return;
        active = activeRows.map(toUiTrack);
        setExcluded(hiddenRows.map(toUiTrack));
      } catch {
        if (cancelled) return;
        setExcluded([]);
      }

      if (Platform.OS === 'web') {
        setLibraryTracks(DEMO_TRACKS);
        setStatus('ready');
        setStatusNote('Web preview: demo library');
        setLibraryLoaded(true);
        void refreshTags();
        return;
      }

      if (scanEnabled !== true) {
        setLibraryTracks(active.length > 0 ? active : DEMO_TRACKS);
        setStatus(active.length > 0 ? 'ready' : 'empty');
        setLibraryLoaded(true);
        void refreshTags();
        return;
      }

      try {
        const granted = await ensureAudioPermission();
        if (cancelled) return;
        if (!granted) {
          setLibraryTracks(active.length > 0 ? active : DEMO_TRACKS);
          setStatus('denied');
          if (active.length > 0) {
            setStatusNote('Audio permission denied. Showing imported tracks.');
          }
          return;
        }
        const result = await scanLibrary();
        if (cancelled) return;
        assetsRef.current = result.assets;
        const root = await getStorageRoot();
        await syncScanResults(result.candidates, { rootUri: root.uri });
        const [activeRows, hiddenRows] = await Promise.all([
          listActiveTracks(),
          listHiddenTracks(),
        ]);
        if (cancelled) return;
        active = activeRows.map(toUiTrack);
        setLibraryTracks(active.length > 0 ? active : DEMO_TRACKS);
        setExcluded(hiddenRows.map(toUiTrack));
        setStatus(active.length > 0 ? 'ready' : 'empty');
      } catch {
        if (cancelled) return;
        setLibraryTracks(active.length > 0 ? active : DEMO_TRACKS);
        setStatus('error');
      } finally {
        if (!cancelled) {
          setLibraryLoaded(true);
          void refreshTags();
        }
      }
    }

    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [refreshTags, scanEnabled, scanId, scanPrefLoaded]);

  useEffect(() => {
    screenRef.current = screen;
    tabRef.current = tab;
    editOpenRef.current = editTarget !== null;
    likedOpenRef.current = likedOpen;
    playlistsOpenRef.current = playlistsOpen;
    openPlaylistIdRef.current = openPlaylistId;
  }, [editTarget, likedOpen, openPlaylistId, playlistsOpen, screen, tab]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backInterceptorRef.current?.()) {
        exitArmedRef.current = null;
        return true;
      }
      const action = resolveBack({
        sleepOpen: false,
        editOpen: editOpenRef.current,
        likedOpen: likedOpenRef.current,
        playlistsOpen: playlistsOpenRef.current,
        openPlaylistId: openPlaylistIdRef.current,
        screen: screenRef.current,
        tab: tabRef.current,
      });
      if (action !== 'arm-exit') exitArmedRef.current = null;
      switch (action) {
        case 'close-sleep':
          return true;
        case 'close-edit':
          setEditTarget(null);
          return true;
        case 'close-liked':
          setLikedOpen(false);
          return true;
        case 'close-playlist-detail':
          setOpenPlaylistId(null);
          return true;
        case 'close-playlists':
          setPlaylistsOpen(false);
          refreshPlaylists();
          return true;
        case 'close-now-playing':
          if (closeNowPlayingRef.current) closeNowPlayingRef.current();
          else setScreen(returnScreenRef.current);
          return true;
        case 'close-hidden-tracks':
          setScreen('settings');
          return true;
        case 'close-settings':
          setScreen(settingsReturnRef.current);
          return true;
        case 'close-search':
          setScreen(searchReturnRef.current);
          return true;
        case 'tab-to-library':
          setTab('library');
          setScreen('library');
          return true;
        case 'arm-exit': {
          const now = Date.now();
          if (exitArmedRef.current !== null && now - exitArmedRef.current <= EXIT_WINDOW_MS) {
            BackHandler.exitApp();
            return true;
          }
          exitArmedRef.current = now;
          showToast('Press back again to exit');
          return true;
        }
      }
    });
    return () => sub.remove();
  }, [refreshPlaylists, showToast]);

  useEffect(() => {
    if (screen === 'library') refreshRecent();
  }, [screen, refreshRecent]);

  useEffect(() => {
    if (lastError === 'File missing') setStatusNote('File missing');
  }, [lastError]);

  useEffect(() => {
    resumeSnapshotRef.current = currentTrack
      ? { trackId: currentTrack.id, positionMs }
      : null;
    if (currentTrack) {
      lastPositionRef.current = { trackId: currentTrack.id, positionMs };
    } else if (lastPositionRef.current) {
      const last = lastPositionRef.current;
      lastPositionRef.current = null;
      void AsyncStorage.setItem(
        RESUME_KEY,
        serializeResume({ trackId: last.trackId, positionMs: last.positionMs }),
      ).catch(() => {});
    }
  }, [currentTrack, positionMs]);

  const persistResume = useCallback(() => {
    const snapshot = resumeSnapshotRef.current;
    if (!snapshot) return;
    void AsyncStorage.setItem(
      RESUME_KEY,
      serializeResume({ trackId: snapshot.trackId, positionMs: snapshot.positionMs }),
    ).catch(() => {});
  }, []);

  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) persistResume();
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, persistResume]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(persistResume, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, persistResume]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') persistResume();
    });
    let removeWebListener: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = () => persistResume();
      window.addEventListener('pagehide', handler);
      removeWebListener = () => window.removeEventListener('pagehide', handler);
    }
    return () => {
      sub.remove();
      removeWebListener?.();
    };
  }, [persistResume]);

  useEffect(() => {
    if (!libraryLoaded || resumedRef.current) return;
    resumedRef.current = true;
    void (async () => {
      const raw = await AsyncStorage.getItem(RESUME_KEY);
      const saved = parseResume(raw);
      if (!saved) return;
      const target = tracks.find((track) => track.id === saved.trackId);
      if (!target) {
        await AsyncStorage.removeItem(RESUME_KEY);
        return;
      }
      const restored = await restore(
        target,
        (track) => resolvePlaybackUri(track, assetsRef.current),
        saved.positionMs,
      );
      if (!restored) await AsyncStorage.removeItem(RESUME_KEY);
    })().catch(() => {});
  }, [libraryLoaded, restore, tracks]);

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
      (t) => resolvePlaybackUri(t, assetsRef.current),
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

  function selectFromOverlay(track: Track, queue?: Track[]) {
    setLikedOpen(false);
    setPlaylistsOpen(false);
    setOpenPlaylistId(null);
    void handleSelect(track, queue);
  }

  function playQueue(queue: Track[]) {
    if (queue.length === 0) return;
    selectFromOverlay(queue[0], queue);
  }

  async function hideTrack(track: Track) {
    if (track.source === 'demo') return;
    try {
      await setTrackStatus(track.id, 'hidden');
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not hide this track');
      return;
    }
    removeFromQueue([track.id]);
    setStatusNote(null);
  }

  async function handleRestore(id: string) {
    try {
      await setTrackStatus(id, 'active');
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not restore this track');
      return;
    }
    setStatusNote(null);
  }

  async function handleRestoreAll() {
    try {
      const ids = excluded.map((track) => track.id);
      for (let start = 0; start < ids.length; start += 50) {
        const chunk = ids.slice(start, start + 50);
        await Promise.all(chunk.map((id) => setTrackStatus(id, 'active')));
      }
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not restore the hidden tracks');
      return;
    }
    setStatusNote(null);
  }

  async function excludeAllTracks() {
    const targets = libraryTracks.filter(
      (track) => track.source === 'scan' && !excludedIds.has(track.id),
    );
    if (targets.length === 0) return;
    try {
      await Promise.all(targets.map((track) => setTrackStatus(track.id, 'hidden')));
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not hide the scanned tracks');
      return;
    }
    removeFromQueue(targets.map((track) => track.id));
    setStatusNote(`${targets.length} scanned tracks hidden. Restore them in Settings.`);
  }

  async function handleClear(track: Track) {
    try {
      await clearTrack(track.id);
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not remove this track');
      return;
    }
    removeFromQueue([track.id]);
    if (currentTrack?.id === track.id) stop();
    setStatusNote(null);
  }

  async function deleteTrack(track: Track) {
    try {
      await deleteTrackEverywhere(track, assetsRef.current);
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not delete this file');
      return;
    }
    removeFromQueue([track.id]);
    setStatusNote(null);
    if (currentTrack?.id === track.id) stop();
  }

  function handleManage(track: Track) {
    if (track.source === 'demo') return;
    setActionTrack(track);
  }

  async function handleFavorite(track: Track) {
    try {
      const liked = await toggleFavorite(track.id);
      setStatusNote(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs');
    } catch {
      setStatusNote('Could not update Liked Songs');
    }
  }

  function handleTrackSaved(saved: Track) {
    setLibraryTracks((prev) =>
      prev.some((track) => track.id === saved.id)
        ? prev.map((track) => (track.id === saved.id ? saved : track))
        : [...prev, saved],
    );
    setStatusNote(null);
  }

  async function chooseScan(enabled: boolean) {
    setScanPrompt(false);
    let next = enabled;
    if (enabled) {
      const granted = await ensureAudioPermission().catch(() => false);
      next = granted;
      if (!granted) {
        setStatusNote('Audio permission denied. Imported files stay available.');
      }
    }
    setScanEnabled(next);
    await saveScanPref(next).catch(() => {});
  }

  async function handleScanToggle(enabled: boolean) {
    if (!enabled) {
      setScanEnabled(false);
      await saveScanPref(false).catch(() => {});
      removeFromQueue(
        libraryTracks.filter((track) => track.source === 'scan').map((track) => track.id),
      );
      return;
    }
    const granted = await ensureAudioPermission().catch(() => false);
    if (!granted) {
      setStatusNote('Audio permission denied. Imported files stay available.');
      setScanEnabled(false);
      await saveScanPref(false).catch(() => {});
      return;
    }
    setStatusNote(null);
    setScanEnabled(true);
    await saveScanPref(true).catch(() => {});
  }

  async function handleImport() {
    if (Platform.OS === 'web') return;
    setImporting(true);
    setImportFailures([]);
    try {
      const { added, skipped, failures } = await pickAndImportTracks();
      setImportFailures(failures);
      const skippedNote =
        skipped.length > 0
          ? `${skipped.length} file${skipped.length === 1 ? '' : 's'} already in the library`
          : null;
      if (added.length === 0) {
        setStatusNote(skippedNote);
        return;
      }
      const uiAdded = added.map(toUiTrack);
      setLibraryTracks((prev) =>
        mergeLibrary(
          prev.filter((item) => item.source !== 'demo'),
          uiAdded,
          new Set(),
        ),
      );
      setStatus('ready');
      setStatusNote(skippedNote);
      void refreshTags();
      selectTab('library');
      showToast(importResultMessage(added.length, failures.length));
    } finally {
      setImporting(false);
    }
  }

  const fullScreenOverlay =
    playlistsOpen || likedOpen || editTarget !== null;
  const showTabs =
    !fullScreenOverlay && (screen === 'library' || screen === 'import');
  const showTabBar =
    screen !== 'nowPlaying' &&
    screen !== 'search' &&
    screen !== 'hiddenTracks' &&
    !fullScreenOverlay;
  const activeTab: TabName =
    screen === 'library' || screen === 'import' ? screen : tab;

  function openSearch() {
    searchReturnRef.current = activeTab;
    setScreen('search');
  }

  function openSettings() {
    settingsReturnRef.current = activeTab;
    setScreen('settings');
  }

  function openHiddenTracks() {
    setScreen('hiddenTracks');
  }

  function closeHiddenTracks() {
    setScreen('settings');
  }

  function selectTab(next: TabName) {
    setTab(next);
    setScreen(next);
  }

  function openPlaylists(id: string | null) {
    setPlaylistsOpen(true);
    setOpenPlaylistId(id);
  }

  function closePlaylists() {
    setPlaylistsOpen(false);
    setOpenPlaylistId(null);
    refreshPlaylists();
  }

  return (
    <View style={styles.root}>
      <BlurTargetView
        ref={blurTargetRef}
        style={styles.library}
        accessibilityElementsHidden={!showTabs}
        importantForAccessibility={showTabs ? 'auto' : 'no-hide-descendants'}
      >
        {activeTab === 'library' ? (
          <LibraryScreen
            tracks={filteredTracks}
            recentTracks={recentTracks}
            tags={tags}
            selectedTagId={selectedTagId}
            onSelectTag={setSelectedTagId}
            status={status}
            statusNote={statusNote ?? hiddenNote}
            onSelect={handleSelect}
            onManage={handleManage}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
            playlists={playlists}
            likedCount={favoriteCount}
            onOpenLiked={() => setLikedOpen(true)}
            onOpenPlaylists={() => openPlaylists(null)}
            onOpenPlaylist={(id) => openPlaylists(id)}
          />
        ) : (
          <ImportScreen
            importing={importing}
            importFailures={importFailures}
            onImport={handleImport}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        )}
      </BlurTargetView>
      {screen === 'nowPlaying' && currentTrack ? (
        <NowPlayingScreen
          onClose={() => setScreen(returnScreenRef.current)}
          onClearTrack={(track) => setClearTarget(track)}
          onDeleteFile={(track) => setDeleteTarget(track)}
          registerClose={registerClose}
          registerBackInterceptor={registerBackInterceptor}
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
        onExcludeAll={() => setExcludeAllConfirm(true)}
        excluded={excluded}
        onRestore={(id) => void handleRestore(id)}
        onRestoreAll={() => void handleRestoreAll()}
        canExcludeAll={scanExcludeCount > 0}
        scanEnabled={scanEnabled === true}
        onToggleScan={(enabled) => void handleScanToggle(enabled)}
        hiddenCount={excluded.length}
        onOpenHiddenTracks={openHiddenTracks}
      />
      <HiddenTracksScreen
        visible={screen === 'hiddenTracks'}
        tracks={excluded}
        onBack={closeHiddenTracks}
        onRestore={(id) => void handleRestore(id)}
        onRestoreAll={() => void handleRestoreAll()}
        onClear={(track) => setClearTarget(track)}
        onDelete={(track) => setDeleteTarget(track)}
      />
      {playlistsOpen ? (
        <View style={styles.overlay}>
          <PlaylistsScreen
            tracks={tracks}
            playlistId={openPlaylistId}
            onOpenPlaylist={setOpenPlaylistId}
            onClose={closePlaylists}
            onPlaylistsChanged={refreshPlaylists}
            onPlay={playQueue}
            onSelect={selectFromOverlay}
          />
        </View>
      ) : null}
      {likedOpen ? (
        <View style={styles.overlay}>
          <LikedScreen
            tracks={tracks}
            onClose={() => setLikedOpen(false)}
            onPlay={playQueue}
            onSelect={selectFromOverlay}
          />
        </View>
      ) : null}
      {editTarget ? (
        <View style={styles.overlay}>
          <EditTrackScreen
            track={editTarget.track}
            mode={editTarget.mode}
            onSaved={handleTrackSaved}
            onClose={() => setEditTarget(null)}
          />
        </View>
      ) : null}
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
            <TabBar active={activeTab} onSelect={selectTab} blurTarget={blurTargetRef} />
          </View>
        </View>
      ) : null}
      <TrackActionsSheet
        track={actionTrack}
        favorite={actionTrack ? favoriteIds.has(actionTrack.id) : false}
        missing={actionTrack ? isMissingTrack(actionTrack) : false}
        onClose={() => setActionTrack(null)}
        onDetails={(track) => setEditTarget({ track, mode: 'details' })}
        onEdit={(track) => setEditTarget({ track, mode: 'edit' })}
        onRename={(track) => setEditTarget({ track, mode: 'rename' })}
        onExclude={(track) => void hideTrack(track)}
        onDelete={(track) => setDeleteTarget(track)}
        onClear={(track) => setClearTarget(track)}
        onDeleteFile={(track) => setDeleteTarget(track)}
        onFavorite={(track) => void handleFavorite(track)}
        onAddToPlaylist={(track) => setPickerTrack(track)}
      />
      <PlaylistPickerSheet
        visible={pickerTrack !== null}
        track={pickerTrack}
        onClose={() => setPickerTrack(null)}
        onAdded={() => refreshPlaylists()}
      />
      <ConfirmSheet
        visible={clearTarget !== null}
        title="Remove from library?"
        message={
          clearTarget
            ? `"${clearTarget.title}" will be removed from the library. The audio file stays on this device.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          const track = clearTarget;
          setClearTarget(null);
          if (track) void handleClear(track);
        }}
        onCancel={() => setClearTarget(null)}
      />
      <ConfirmSheet
        visible={deleteTarget !== null}
        title="Delete file?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" and its audio file will be deleted from this device. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete file"
        destructive
        onConfirm={() => {
          const track = deleteTarget;
          setDeleteTarget(null);
          if (track) void deleteTrack(track);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmSheet
        visible={excludeAllConfirm}
        title="Hide all scanned tracks?"
        message={`${scanExcludeCount} scanned tracks will be hidden from the library. You can restore them in Settings.`}
        confirmLabel="Hide all"
        destructive
        onConfirm={() => {
          setExcludeAllConfirm(false);
          void excludeAllTracks();
        }}
        onCancel={() => setExcludeAllConfirm(false)}
      />
      <Sheet
        visible={scanPrompt}
        title="Scan this device for audio?"
        onClose={() => void chooseScan(false)}
      >
        <Text style={styles.sheetText}>
          Krotify can scan this device for audio files. Scanned files stay on this device.
          Imported files are always available.
        </Text>
        <View style={styles.sheetActions}>
          <Pressable
            onPress={() => void chooseScan(false)}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => [
              styles.sheetButton,
              pressed && styles.sheetPressed,
            ]}
          >
            <Text style={styles.sheetButtonText}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={() => void chooseScan(true)}
            accessibilityRole="button"
            accessibilityLabel="Scan this device"
            style={({ pressed }) => [
              styles.sheetButton,
              styles.sheetButtonPrimary,
              pressed && styles.sheetPressed,
            ]}
          >
            <Text style={styles.sheetButtonText}>Scan</Text>
          </Pressable>
        </View>
      </Sheet>
      <Toast
        key={toast?.id}
        visible={toast !== null}
        message={toast?.message ?? ''}
        onHidden={() => setToast(null)}
      />
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
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: colors.bg,
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
  sheetText: {
    ...type.meta,
    color: colors.textDim,
    lineHeight: 20,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.sm,
  },
  sheetButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  sheetButtonPrimary: {
    backgroundColor: colors.accent,
  },
  sheetButtonText: {
    ...type.body,
    color: colors.text,
  },
  sheetPressed: {
    opacity: 0.75,
  },
});
