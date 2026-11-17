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
import { TagAssignSheet } from './components/TagAssignSheet';
import { Toast } from './components/Toast';
import {
  PlaylistPickerSheet,
  TrackActionsSheet,
} from './components/TrackActionsSheet';
import { recordPlay } from './db/repo';
import { getScanSummary, type ScanSummary } from './db/settings';
import { pickAndImportTracks, type ImportFailure } from './imports/local';
import { DEMO_TRACKS } from './library/demo';
import { useFavorites } from './library/FavoritesProvider';
import { grantAudioPermission, readAudioPermissionState } from './library/permissions';
import { resolvePlaybackUri } from './library/playbackSource';
import { ensureAudioPermission, scanLibrary } from './library/scan';
import { readScanPref, saveScanPref } from './library/scanPrefs';
import { resolveBack } from './lib/backIntent';
import { resolveBlurLayer } from './lib/layerTarget';
import { mergeLibrary, sortTracks } from './lib/library';
import { importResultMessage } from './lib/importResult';
import { parseResume, serializeResume } from './lib/resume';
import {
  formatBytes,
  isMissingTrack,
  type PermissionState,
  type StorageView,
} from './lib/settingsView';
import { usePlayer } from './player/PlayerProvider';
import {
  chooseStorageRoot,
  cleanRemovedOwnedFiles,
  getStorageRoot,
  moveOwnedFiles,
  setStorageRoot,
  storageInfo,
} from './storage/root';
import type { StorageRoot } from './storage/types';
import { filterTracksByTag, reconcileTagFilter } from './tags/filter';
import { useTags } from './tags/TagProvider';
import { clearTrack, deleteTrackEverywhere } from './tracks/actions';
import { listActiveTracks, listHiddenTracks, setTrackStatus } from './tracks/repo';
import { syncScanResults } from './tracks/scanSync';
import type { TrackRecord } from './tracks/types';
import { toUiTrack } from './tracks/view';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { EditTrackScreen } from './screens/EditTrackScreen';
import { HiddenTracksScreen } from './screens/HiddenTracksScreen';
import { ImportScreen } from './screens/ImportScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { LikedScreen } from './screens/LikedScreen';
import { NowPlayingScreen } from './screens/NowPlayingScreen';
import { PlaylistsScreen } from './screens/PlaylistsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TechStackScreen } from './components/TechStackScreen';
import { colors, radius, space, type } from './theme';
import type { LibraryStatus, ScreenName, Track } from './types';

const RESUME_KEY = 'krotify.resume.v1';
const EXIT_WINDOW_MS = 2000;

const toStorageView = (
  info: Awaited<ReturnType<typeof storageInfo>>,
): StorageView => ({
  folderName: info.root.name,
  fileCount: info.fileCount,
  totalBytes: info.totalBytes,
  reclaimableBytes: info.reclaimableBytes,
});

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
  const [excluded, setExcluded] = useState<Track[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('scanning');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [scanId, setScanId] = useState(0);
  const [scanEnabled, setScanEnabled] = useState<boolean | null>(null);
  const [scanPrefLoaded, setScanPrefLoaded] = useState(false);
  const [scanPrompt, setScanPrompt] = useState(false);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [storage, setStorage] = useState<StorageView | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [movePrompt, setMovePrompt] = useState<{
    fileCount: number;
    totalBytes: number;
  } | null>(null);
  const [cleanPrompt, setCleanPrompt] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [likedOpen, setLikedOpen] = useState(false);
  const [techStackOpen, setTechStackOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState<Track | null>(null);
  const [clearTarget, setClearTarget] = useState<Track | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);
  const [excludeAllConfirm, setExcludeAllConfirm] = useState(false);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);
  const [tagTrack, setTagTrack] = useState<Track | null>(null);
  const [editTarget, setEditTarget] = useState<Track | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const assetsRef = useRef(new Map<string, Asset>());
  const blurTargetRef = useRef<ComponentRef<typeof View> | null>(null);
  const searchBlurRef = useRef<ComponentRef<typeof View> | null>(null);
  const settingsBlurRef = useRef<ComponentRef<typeof View> | null>(null);
  const hiddenBlurRef = useRef<ComponentRef<typeof View> | null>(null);
  const playlistsBlurRef = useRef<ComponentRef<typeof View> | null>(null);
  const likedBlurRef = useRef<ComponentRef<typeof View> | null>(null);
  const detailsBlurRef = useRef<ComponentRef<typeof View> | null>(null);
  const techStackBlurRef = useRef<ComponentRef<typeof View> | null>(null);
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
  const pendingRootRef = useRef<StorageRoot | null>(null);
  const previousRootRef = useRef<StorageRoot | null>(null);
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
  const effectiveTagId = reconcileTagFilter(selectedTagId, tags);
  if (effectiveTagId !== selectedTagId) setSelectedTagId(effectiveTagId);
  const filteredTracks = useMemo(
    () => filterTracksByTag(tracks, effectiveTagId, assignments),
    [tracks, effectiveTagId, assignments],
  );
  const hiddenScannedCount = useMemo(
    () => excluded.filter((track) => track.source === 'scan').length,
    [excluded],
  );
  const hiddenNote =
    hiddenScannedCount > 0
      ? `${hiddenScannedCount} scanned track${hiddenScannedCount === 1 ? '' : 's'} hidden. Restore them in Settings.`
      : null;
  const scanExcludeCount = useMemo(
    () =>
      libraryTracks.filter(
        (track) => track.source === 'scan' && !excludedIds.has(track.id),
      ).length,
    [excludedIds, libraryTracks],
  );



  const refreshLibraryFromDb = useCallback(async () => {
    const [active, hidden] = await Promise.all([listActiveTracks(), listHiddenTracks()]);
    setLibraryTracks(active.map(toUiTrack));
    setExcluded(hidden.map(toUiTrack));
    void refreshTags();
  }, [refreshTags]);

  const refreshPermission = useCallback(() => {
    void readAudioPermissionState()
      .then((next) => setPermission(next))
      .catch(() => {});
  }, []);

  const refreshStorage = useCallback(async () => {
    try {
      setStorage(toStorageView(await storageInfo()));
    } catch {}
  }, []);

  const refreshScanSummary = useCallback(() => {
    void getScanSummary()
      .then((summary) => setScanSummary(summary))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readAudioPermissionState()
      .then((next) => {
        if (!cancelled) setPermission(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen !== 'settings') return;
    let cancelled = false;
    void readAudioPermissionState()
      .then((next) => {
        if (!cancelled) setPermission(next);
      })
      .catch(() => {});
    void (async () => {
      try {
        const next = toStorageView(await storageInfo());
        if (!cancelled) setStorage(next);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'settings' || status === 'scanning') return;
    refreshScanSummary();
  }, [screen, status, refreshScanSummary]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);


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
      if (techStackOpen) {
        setTechStackOpen(false);
        return true;
      }
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
  }, [showToast, techStackOpen]);




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

  function closeNowPlayingIfOpen() {
    if (screenRef.current !== 'nowPlaying') return;
    if (closeNowPlayingRef.current) closeNowPlayingRef.current();
    else setScreen(returnScreenRef.current);
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
      setLibraryTracks((prev) =>
        prev.map((item) => (item.id === track.id ? { ...item, missing: 1 } : item)),
      );
      setStatusNote('File missing');
    } else {
      setStatusNote(null);
      void recordPlay(track.id).catch(() => {});
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
      showToast('Could not restore this track');
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
      showToast('Could not restore the hidden tracks');
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
      showToast('Could not remove this track');
      return;
    }
    removeFromQueue([track.id]);
    if (currentTrack?.id === track.id) {
      stop();
      closeNowPlayingIfOpen();
    }
    setStatusNote(null);
  }

  async function deleteTrack(track: Track) {
    try {
      await deleteTrackEverywhere(track, assetsRef.current);
      await refreshLibraryFromDb();
    } catch {
      showToast('Could not delete this file');
      return;
    }
    removeFromQueue([track.id]);
    setStatusNote(null);
    if (currentTrack?.id === track.id) {
      stop();
      closeNowPlayingIfOpen();
    }
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

  async function handleGrant() {
    const next = await grantAudioPermission();
    setPermission(next);
  }

  function handleRescan() {
    setScanId((n) => n + 1);
  }

  async function handleChangeFolder() {
    if (storageBusy) return;
    setStorageBusy(true);
    try {
      const previous = await storageInfo().catch(() => null);
      const root = await chooseStorageRoot();
      if (!root) return;
      pendingRootRef.current = root;
      previousRootRef.current = previous?.root ?? null;
      await refreshStorage();
      if (previous && previous.fileCount > 0) {
        setMovePrompt({
          fileCount: previous.fileCount,
          totalBytes: previous.totalBytes,
        });
      }
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleMoveFiles(target?: StorageRoot) {
    if (storageBusy) return;
    setStorageBusy(true);
    try {
      const to = target ?? (await getStorageRoot());
      const from = previousRootRef.current;
      let result: Awaited<ReturnType<typeof moveOwnedFiles>>;
      if (from && from.uri !== to.uri) {
        await setStorageRoot(from);
        try {
          result = await moveOwnedFiles(to);
        } finally {
          await setStorageRoot(to);
        }
      } else {
        result = await moveOwnedFiles(to);
      }
      previousRootRef.current = null;
      pendingRootRef.current = null;
      const movedLabel = `${result.moved} file${result.moved === 1 ? '' : 's'}`;
      await Promise.all([refreshStorage(), refreshLibraryFromDb()]);
      showToast(
        result.failures.length > 0
          ? `Moved ${movedLabel}, ${result.failures.length} failed`
          : `Moved ${movedLabel}`,
      );
    } catch {
      showToast('Could not move files');
    } finally {
      setStorageBusy(false);
    }
  }

  async function handleCleanStorage() {
    if (storageBusy) return;
    setStorageBusy(true);
    try {
      const { deleted, bytes } = await cleanRemovedOwnedFiles();
      const deletedLabel = `${deleted} file${deleted === 1 ? '' : 's'}`;
      await Promise.all([refreshStorage(), refreshLibraryFromDb()]);
      showToast(
        bytes > 0
          ? `Deleted ${deletedLabel} (${formatBytes(bytes)})`
          : `Deleted ${deletedLabel}`,
      );
    } catch {
      showToast('Could not clean files');
    } finally {
      setStorageBusy(false);
    }
  }

  function cancelMovePrompt() {
    setMovePrompt(null);
    pendingRootRef.current = null;
    previousRootRef.current = null;
  }

  function handleLinkImported(record: TrackRecord) {
    const track = toUiTrack(record);
    setLibraryTracks((prev) =>
      mergeLibrary(
        prev.filter((item) => item.source !== 'demo'),
        [track],
        new Set(),
      ),
    );
    setStatus('ready');
    setStatusNote(null);
    void refreshTags();
    selectTab('library');
    showToast(`Added ${track.title}`);
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

  const fullScreenOverlay = editTarget !== null;
  const showTabs =
    !fullScreenOverlay &&
    (screen === 'library' || screen === 'import' || screen === 'collections');
  const showTabBar = screen !== 'nowPlaying';
  const activeTab: TabName =
    screen === 'library' || screen === 'import' || screen === 'collections' ? screen : tab;
  const blurLayer = resolveBlurLayer({
    details: editTarget !== null,
    liked: likedOpen,
    playlists: playlistsOpen,
    techStack: techStackOpen,
    hidden: screen === 'hiddenTracks',
    settings: screen === 'settings' || screen === 'hiddenTracks',
    search: screen === 'search',
  });
  const activeBlurTarget = {
    details: detailsBlurRef,
    liked: likedBlurRef,
    playlists: playlistsBlurRef,
    techStack: techStackBlurRef,
    hidden: hiddenBlurRef,
    settings: settingsBlurRef,
    search: searchBlurRef,
    base: blurTargetRef,
  }[blurLayer];

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
    setPlaylistsOpen(false);
    setOpenPlaylistId(null);
    setLikedOpen(false);
    setEditTarget(null);
    setTechStackOpen(false);
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
            tags={tags}
            selectedTagId={effectiveTagId}
            onSelectTag={setSelectedTagId}
            status={status}
            statusNote={
              statusNote ?? (lastError === 'File missing' ? 'File missing' : null) ?? hiddenNote
            }
            onSelect={handleSelect}
            onManage={handleManage}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
            onOpenLiked={() => setLikedOpen(true)}
            onOpenPlaylists={() => openPlaylists(null)}
          />
        ) : activeTab === 'import' ? (
          <ImportScreen
            active={screen === 'import'}
            importing={importing}
            importFailures={importFailures}
            onImport={handleImport}
            onLinkImported={handleLinkImported}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
          />
        ) : (
          <CollectionsScreen
            visible={screen === 'collections'}
            tracks={tracks}
            likedCount={favoriteIds.size}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
            onOpenLiked={() => setLikedOpen(true)}
            onOpenPlaylists={() => openPlaylists(null)}
            onPlay={playQueue}
            onSelect={selectFromOverlay}
          />
        )}
      </BlurTargetView>
      {screen === 'nowPlaying' && currentTrack ? (
        <NowPlayingScreen
          onClose={() => setScreen(returnScreenRef.current)}
          onDetails={(track) => setEditTarget(track)}
          onClearTrack={(track) => setClearTarget(track)}
          onDeleteFile={(track) => setDeleteTarget(track)}
          registerClose={registerClose}
          registerBackInterceptor={registerBackInterceptor}
        />
      ) : null}
      <BlurTargetView
        ref={searchBlurRef}
        style={[StyleSheet.absoluteFill, screen !== 'search' && styles.layerHidden]}
        pointerEvents={screen === 'search' ? 'auto' : 'none'}
      >
        <SearchScreen
          visible={screen === 'search'}
          tracks={tracks}
          onSelect={handleSelect}
          onBack={() => setScreen(searchReturnRef.current)}
        />
      </BlurTargetView>
      <BlurTargetView
        ref={settingsBlurRef}
        style={[
          StyleSheet.absoluteFill,
          screen !== 'settings' && screen !== 'hiddenTracks' && styles.layerHidden,
        ]}
        pointerEvents={screen === 'settings' ? 'auto' : 'none'}
      >
      <SettingsScreen
        visible={screen === 'settings' || screen === 'hiddenTracks'}
        status={status}
        scanEnabled={scanEnabled === true}
        permission={permission}
        scanSummary={scanSummary}
        hiddenCount={excluded.length}
        scanExcludeCount={scanExcludeCount}
        storage={storage}
        storageBusy={storageBusy}
        onBack={() => {
          setTechStackOpen(false);
          setScreen(settingsReturnRef.current);
        }}
        onToggleScan={(enabled) => void handleScanToggle(enabled)}
        onGrant={() => void handleGrant()}
        onRescan={handleRescan}
        onOpenHiddenTracks={openHiddenTracks}
        onExcludeAll={() => setExcludeAllConfirm(true)}
        onChangeFolder={() => void handleChangeFolder()}
        onMoveFiles={() => void handleMoveFiles()}
        onCleanStorage={() => setCleanPrompt(true)}
        onTagsChanged={refreshTags}
        onOpenTechStack={() => setTechStackOpen(true)}
      />
      </BlurTargetView>
      <BlurTargetView
        ref={hiddenBlurRef}
        style={[StyleSheet.absoluteFill, screen !== 'hiddenTracks' && styles.layerHidden]}
        pointerEvents={screen === 'hiddenTracks' ? 'auto' : 'none'}
      >
        <HiddenTracksScreen
          visible={screen === 'hiddenTracks'}
          tracks={excluded}
          onBack={closeHiddenTracks}
          onRestore={(id) => void handleRestore(id)}
          onRestoreAll={() => void handleRestoreAll()}
          onClear={(track) => setClearTarget(track)}
          onDelete={(track) => setDeleteTarget(track)}
        />
      </BlurTargetView>
      <BlurTargetView
        ref={techStackBlurRef}
        style={[StyleSheet.absoluteFill, !techStackOpen && styles.layerHidden]}
        pointerEvents={techStackOpen ? 'auto' : 'none'}
      >
        <TechStackScreen visible={techStackOpen} onBack={() => setTechStackOpen(false)} />
      </BlurTargetView>
      {playlistsOpen ? (
        <BlurTargetView ref={playlistsBlurRef} style={styles.overlay}>
          <PlaylistsScreen
            tracks={tracks}
            playlistId={openPlaylistId}
            onOpenPlaylist={setOpenPlaylistId}
            onClose={closePlaylists}
            onPlay={playQueue}
            onSelect={selectFromOverlay}
          />
        </BlurTargetView>
      ) : null}
      {likedOpen ? (
        <BlurTargetView ref={likedBlurRef} style={styles.overlay}>
          <LikedScreen
            tracks={tracks}
            onClose={() => setLikedOpen(false)}
            onPlay={playQueue}
            onSelect={selectFromOverlay}
          />
        </BlurTargetView>
      ) : null}
      {editTarget ? (
        <BlurTargetView ref={detailsBlurRef} style={styles.overlay}>
          <EditTrackScreen
            track={editTarget}
            onSaved={handleTrackSaved}
            onClose={() => setEditTarget(null)}
          />
        </BlurTargetView>
      ) : null}
      {showTabBar ? (
        <View style={styles.bottom}>
          <View style={styles.miniPlayer}>
            <MiniPlayer
              onExpand={() => {
                rememberReturnScreen();
                setTechStackOpen(false);
                setScreen('nowPlaying');
              }}
            />
          </View>
          <View style={styles.tabBar}>
            <TabBar active={activeTab} onSelect={selectTab} blurTarget={activeBlurTarget} />
          </View>
        </View>
      ) : null}
      <TrackActionsSheet
        track={actionTrack}
        favorite={actionTrack ? favoriteIds.has(actionTrack.id) : false}
        missing={actionTrack ? isMissingTrack(actionTrack) : false}
        onClose={() => setActionTrack(null)}
        onDetails={(track) => setEditTarget(track)}
        onTags={(track) => setTagTrack(track)}
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
      />
      <TagAssignSheet
        visible={tagTrack !== null}
        track={tagTrack}
        onClose={() => setTagTrack(null)}
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
      <ConfirmSheet
        visible={movePrompt !== null}
        title="Move files to the new folder?"
        message={
          movePrompt
            ? `Move ${movePrompt.fileCount} files (${formatBytes(movePrompt.totalBytes)}) now. You can also leave them where they are.`
            : ''
        }
        confirmLabel="Move files"
        destructive
        onConfirm={() => {
          const target = pendingRootRef.current;
          setMovePrompt(null);
          void handleMoveFiles(target ?? undefined);
        }}
        onCancel={cancelMovePrompt}
      />
      <ConfirmSheet
        visible={cleanPrompt}
        title="Clean up removed files?"
        message={`Delete ${formatBytes(storage?.reclaimableBytes ?? 0)} of removed files from this device. This cannot be undone.`}
        confirmLabel="Clean"
        destructive
        onConfirm={() => {
          setCleanPrompt(false);
          void handleCleanStorage();
        }}
        onCancel={() => setCleanPrompt(false)}
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
  layerHidden: {
    display: 'none',
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
    zIndex: 30,
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
