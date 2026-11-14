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
import {
  PlaylistPickerSheet,
  TrackActionsSheet,
} from './components/TrackActionsSheet';
import { listPlaylists, listRecentTrackIds, recordPlay, type Playlist } from './db/repo';
import { DEMO_TRACKS } from './library/demo';
import {
  clearExcludedTracks,
  excludeTrack,
  excludeTracks,
  loadExcludedTracks,
  restoreTrack,
} from './library/exclusions';
import { useFavorites } from './library/FavoritesProvider';
import {
  deleteImportedFile,
  loadImportedTracks,
  pickAndImportTracks,
  removeImportedTrack,
} from './library/imports';
import { ensureAudioPermission, scanLibrary } from './library/scan';
import { readScanPref, saveScanPref } from './library/scanPrefs';
import { mergeLibrary, sortTracks } from './lib/library';
import { parseResume, serializeResume } from './lib/resume';
import { enrichTracks } from './library/metadata';
import { usePlayer } from './player/PlayerProvider';
import { CatalogScreen } from './screens/CatalogScreen';
import {
  EditTrackScreen,
  type EditTrackMode,
} from './screens/EditTrackScreen';
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

type EditTarget = { track: Track; mode: EditTrackMode };

export function AppShell() {
  const {
    track: currentTrack,
    isPlaying,
    positionMs,
    playTrack,
    restore,
    stop,
    removeFromQueue,
    setQueue,
  } = usePlayer();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const [screen, setScreen] = useState<ScreenName>('library');
  const [tab, setTab] = useState<TabName>('library');
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [importing, setImporting] = useState(false);
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
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);
  const [excludeAllConfirm, setExcludeAllConfirm] = useState(false);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const assetsRef = useRef(new Map<string, Asset>());
  const blurTargetRef = useRef<ComponentRef<typeof View> | null>(null);
  const closeNowPlayingRef = useRef<(() => void) | null>(null);
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

  const excludedIds = useMemo(() => new Set(excluded.map((track) => track.id)), [excluded]);
  const tracks = useMemo(
    () => sortTracks(libraryTracks.filter((track) => !excludedIds.has(track.id))),
    [libraryTracks, excludedIds],
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

  const recentTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return recentTrackIds
      .map((id) => byId.get(id))
      .filter((track): track is Track => track !== undefined);
  }, [recentTrackIds, tracks]);
  const importedTracks = useMemo(
    () => tracks.filter((track) => track.source === 'import'),
    [tracks],
  );

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
            if (cancelled) return;
            const byId = new Map(batch.map((track) => [track.id, track]));
            setLibraryTracks((prev) => prev.map((track) => byId.get(track.id) ?? track));
          },
        ).catch(() => {});
      }

      if (Platform.OS === 'web') {
        const [, excludedTracks] = await Promise.all([
          loadImportedTracks(),
          loadExcludedTracks(),
        ]);
        if (cancelled) return;
        setExcluded(excludedTracks);
        setLibraryTracks(DEMO_TRACKS);
        setStatus('ready');
        setStatusNote('Web preview: demo library');
        setLibraryLoaded(true);
        return;
      }

      let importedTracks: Track[] = [];
      let excludedTracks: Track[] = [];
      try {
        const [loadedImported, loadedExcluded] = await Promise.all([
          loadImportedTracks(),
          loadExcludedTracks(),
        ]);
        if (cancelled) return;
        importedTracks = loadedImported;
        excludedTracks = loadedExcluded;
        setExcluded(excludedTracks);
        const importOnly = mergeLibrary([], importedTracks, new Set());

        if (scanEnabled !== true) {
          setLibraryTracks(importOnly.length > 0 ? importOnly : DEMO_TRACKS);
          enrich(importOnly);
          setStatus(importOnly.length > 0 ? 'ready' : 'empty');
          return;
        }

        const granted = await ensureAudioPermission();
        if (cancelled) return;
        if (!granted) {
          setLibraryTracks(importOnly.length > 0 ? importOnly : DEMO_TRACKS);
          enrich(importOnly);
          setStatus('denied');
          if (importOnly.length > 0) {
            setStatusNote('Audio permission denied. Showing imported tracks.');
          }
          return;
        }
        const result = await scanLibrary();
        if (cancelled) return;
        assetsRef.current = result.assets;
        const merged = mergeLibrary(result.tracks, importedTracks, new Set());
        setLibraryTracks(merged.length > 0 ? merged : DEMO_TRACKS);
        enrich(merged);
        setStatus(merged.length > 0 ? 'ready' : 'empty');
      } catch {
        if (cancelled) return;
        const importOnly = mergeLibrary([], importedTracks, new Set());
        setLibraryTracks(importOnly.length > 0 ? importOnly : DEMO_TRACKS);
        enrich(importOnly);
        setStatus('error');
      } finally {
        if (!cancelled) setLibraryLoaded(true);
      }
    }

    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [scanEnabled, scanId, scanPrefLoaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editTarget) {
        setEditTarget(null);
        return true;
      }
      if (playlistsOpen) {
        if (openPlaylistId) setOpenPlaylistId(null);
        else {
          setPlaylistsOpen(false);
          refreshPlaylists();
        }
        return true;
      }
      if (likedOpen) {
        setLikedOpen(false);
        return true;
      }
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
  }, [editTarget, likedOpen, openPlaylistId, playlistsOpen, refreshPlaylists, screen, tab]);

  useEffect(() => {
    if (screen === 'library') refreshRecent();
  }, [screen, refreshRecent]);

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
        async (track) => {
          if (track.uri) return track.uri;
          const asset = assetsRef.current.get(track.id);
          if (!asset) throw new Error('missing asset');
          return asset.getUri();
        },
        saved.positionMs,
      );
      if (!restored) await AsyncStorage.removeItem(RESUME_KEY);
    })().catch(() => {});
  }, [libraryLoaded, restore, tracks]);

  const handleArtworkLoaded = useCallback((trackId: string, uri: string) => {
    setLibraryTracks((prev) =>
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
        if (t.uri) return t.uri;
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
    const next = await excludeTrack(track);
    setExcluded(next);
    removeFromQueue([track.id]);
    setStatusNote(null);
  }

  async function handleRestore(id: string) {
    const next = await restoreTrack(id);
    setExcluded(next);
    setStatusNote(null);
  }

  async function handleRestoreAll() {
    const next = await clearExcludedTracks();
    setExcluded(next);
    setStatusNote(null);
  }

  async function excludeAllTracks() {
    const targets = libraryTracks.filter(
      (track) => track.source === 'scan' && !excludedIds.has(track.id),
    );
    if (targets.length === 0) return;
    const next = await excludeTracks(targets);
    setExcluded(next);
    removeFromQueue(targets.map((track) => track.id));
    setStatusNote(`${targets.length} scanned tracks hidden. Restore them in Settings.`);
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
    setLibraryTracks((prev) => prev.filter((item) => item.id !== track.id));
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
    try {
      const added = await pickAndImportTracks();
      if (added.length === 0) return;
      setLibraryTracks((prev) =>
        mergeLibrary(
          prev.filter((item) => item.source !== 'demo'),
          added,
          new Set(),
        ),
      );
      void enrichTracks(
        added,
        async (track) => track.uri || null,
        (batch) => {
          const byId = new Map(batch.map((track) => [track.id, track]));
          setLibraryTracks((prev) => prev.map((track) => byId.get(track.id) ?? track));
        },
      ).catch(() => {});
      setStatus('ready');
      setStatusNote(null);
    } finally {
      setImporting(false);
    }
  }

  const fullScreenOverlay =
    playlistsOpen || likedOpen || editTarget !== null;
  const showTabs =
    !fullScreenOverlay &&
    (screen === 'library' || screen === 'catalog' || screen === 'import');
  const showTabBar =
    screen !== 'nowPlaying' && screen !== 'search' && !fullScreenOverlay;
  const activeTab: TabName =
    screen === 'library' || screen === 'catalog' || screen === 'import' ? screen : tab;

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
            tracks={tracks}
            recentTracks={recentTracks}
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
        ) : activeTab === 'catalog' ? (
          <CatalogScreen
            tracks={tracks}
            onSelect={handleSelect}
            onArtworkLoaded={handleArtworkLoaded}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        ) : (
          <ImportScreen
            imports={importedTracks}
            importing={importing}
            onImport={handleImport}
            onSelect={handleSelect}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        )}
      </BlurTargetView>
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
        onExcludeAll={() => setExcludeAllConfirm(true)}
        excluded={excluded}
        onRestore={(id) => void handleRestore(id)}
        onRestoreAll={() => void handleRestoreAll()}
        canExcludeAll={scanExcludeCount > 0}
        scanEnabled={scanEnabled === true}
        onToggleScan={(enabled) => void handleScanToggle(enabled)}
      />
      {playlistsOpen ? (
        <View style={styles.overlay}>
          <PlaylistsScreen
            tracks={tracks}
            playlistId={openPlaylistId}
            onOpenPlaylist={setOpenPlaylistId}
            onClose={closePlaylists}
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
        onClose={() => setActionTrack(null)}
        onDetails={(track) => setEditTarget({ track, mode: 'details' })}
        onEdit={(track) => setEditTarget({ track, mode: 'edit' })}
        onRename={(track) => setEditTarget({ track, mode: 'rename' })}
        onExclude={(track) => void hideTrack(track)}
        onDelete={(track) => setDeleteTarget(track)}
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
        visible={deleteTarget !== null}
        title="Delete track?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed from this device. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
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
