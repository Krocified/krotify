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
  storageRootIsWritable,
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
import { TagsScreen } from './screens/TagsScreen';
import { TechStackScreen } from './components/TechStackScreen';
import { colors, radius, space, type } from './theme';
import type { LibraryStatus, ScreenName, Track } from './types';

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
    lastError,
    playTrack,
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
  const [moveFailures, setMoveFailures] = useState<{ name: string; reason: string }[]>([]);
  const [movePrompt, setMovePrompt] = useState<{
    fileCount: number;
    totalBytes: number;
  } | null>(null);
  const [cleanPrompt, setCleanPrompt] = useState(false);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [likedOpen, setLikedOpen] = useState(false);
  const [techStackOpen, setTechStackOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState<Track | null>(null);
  const [clearTargets, setClearTargets] = useState<Track[] | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<Track[] | null>(null);
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
  const tagsBlurRef = useRef<ComponentRef<typeof View> | null>(null);
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
        void refreshTags();
        return;
      }

      if (scanEnabled !== true) {
        setLibraryTracks(active.length > 0 ? active : DEMO_TRACKS);
        setStatus(active.length > 0 ? 'ready' : 'empty');
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
        case 'close-tags':
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

  async function hideTracks(list: Track[]) {
    const targets = list.filter((track) => track.source !== 'demo');
    if (targets.length === 0) return;
    try {
      for (let start = 0; start < targets.length; start += 50) {
        const chunk = targets.slice(start, start + 50);
        await Promise.all(chunk.map((track) => setTrackStatus(track.id, 'hidden')));
      }
      await refreshLibraryFromDb();
    } catch {
      setStatusNote('Could not hide these tracks');
      return;
    }
    removeFromQueue(targets.map((track) => track.id));
    setStatusNote(null);
  }

  function hideTrack(track: Track) {
    void hideTracks([track]);
  }

  async function restoreTracks(ids: string[]) {
    if (ids.length === 0) return;
    try {
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

  function handleRestore(id: string) {
    void restoreTracks([id]);
  }

  function handleRestoreAll() {
    void restoreTracks(excluded.map((track) => track.id));
  }

  async function excludeAllTracks() {
    const targets = libraryTracks.filter(
      (track) => track.source === 'scan' && !excludedIds.has(track.id),
    );
    await hideTracks(targets);
  }

  async function clearTracks(list: Track[]) {
    if (list.length === 0) return;
    try {
      for (const track of list) await clearTrack(track.id);
      await refreshLibraryFromDb();
    } catch {
      showToast('Could not remove these tracks');
      return;
    }
    removeFromQueue(list.map((track) => track.id));
    if (list.some((track) => track.id === currentTrack?.id)) {
      stop();
      closeNowPlayingIfOpen();
    }
    setStatusNote(null);
  }

  async function deleteTracks(list: Track[]) {
    if (list.length === 0) return;
    try {
      for (const track of list) await deleteTrackEverywhere(track, assetsRef.current);
      await refreshLibraryFromDb();
    } catch {
      showToast('Could not delete these files');
      return;
    }
    removeFromQueue(list.map((track) => track.id));
    setStatusNote(null);
    if (list.some((track) => track.id === currentTrack?.id)) {
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
    setMoveFailures([]);
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
      setMoveFailures(result.failures);
      await Promise.all([refreshStorage(), refreshLibraryFromDb()]);
      showToast(
        result.failures.length > 0
          ? `Moved ${movedLabel}, ${result.failures.length} failed`
          : `Moved ${movedLabel}`,
      );
    } catch (error) {
      setMoveFailures([
        { name: 'Move files', reason: error instanceof Error ? error.message : String(error) },
      ]);
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
      if (!(await storageRootIsWritable())) {
        showToast('Storage folder access was lost. Choose it again.');
        const root = await chooseStorageRoot();
        if (!root) {
          setStatusNote('Choose a storage folder before importing.');
          return;
        }
      }
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
    tags: screen === 'tags',
    hidden: screen === 'hiddenTracks',
    settings: screen === 'settings' || screen === 'hiddenTracks',
    search: screen === 'search',
  });
  const activeBlurTarget = {
    details: detailsBlurRef,
    liked: likedBlurRef,
    playlists: playlistsBlurRef,
    techStack: techStackBlurRef,
    tags: tagsBlurRef,
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
            statusNote={statusNote ?? (lastError === 'File missing' ? 'File missing' : null)}
            onSelect={handleSelect}
            onManage={handleManage}
            onHideMany={(list) => void hideTracks(list)}
            onDeleteMany={setDeleteTargets}
            onOpenSearch={openSearch}
            onOpenSettings={openSettings}
            onOpenLiked={() => setLikedOpen(true)}
            onOpenPlaylists={() => openPlaylists(null)}
            registerBackInterceptor={registerBackInterceptor}
            onNotify={showToast}
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
          onClearTrack={(track) => setClearTargets([track])}
          onDeleteFile={(track) => setDeleteTargets([track])}
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
        moveFailures={moveFailures}
        onCleanStorage={() => setCleanPrompt(true)}
        onOpenTags={() => setScreen('tags')}
        onOpenTechStack={() => setTechStackOpen(true)}
      />
      </BlurTargetView>
      <BlurTargetView
        ref={tagsBlurRef}
        style={[StyleSheet.absoluteFill, screen !== 'tags' && styles.layerHidden]}
        pointerEvents={screen === 'tags' ? 'auto' : 'none'}
      >
        <TagsScreen
          visible={screen === 'tags'}
          onBack={() => setScreen('settings')}
          registerBackInterceptor={registerBackInterceptor}
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
          onRestore={handleRestore}
          onRestoreMany={(ids) => void restoreTracks(ids)}
          onRestoreAll={() => void handleRestoreAll()}
          onClear={(track) => setClearTargets([track])}
          onDelete={(track) => setDeleteTargets([track])}
          onClearMany={setClearTargets}
          onDeleteMany={setDeleteTargets}
          registerBackInterceptor={registerBackInterceptor}
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
        onExclude={hideTrack}
        onDelete={(track) => setDeleteTargets([track])}
        onClear={(track) => setClearTargets([track])}
        onDeleteFile={(track) => setDeleteTargets([track])}
        onFavorite={(track) => void handleFavorite(track)}
        onAddToPlaylist={(track) => setPickerTrack(track)}
      />
      <PlaylistPickerSheet
        visible={pickerTrack !== null}
        tracks={pickerTrack ? [pickerTrack] : []}
        onClose={() => setPickerTrack(null)}
      />
      <TagAssignSheet
        visible={tagTrack !== null}
        track={tagTrack}
        onClose={() => setTagTrack(null)}
      />
      <ConfirmSheet
        visible={clearTargets !== null}
        title={
          clearTargets?.length === 1
            ? 'Remove from library?'
            : `Remove ${clearTargets?.length ?? 0} tracks?`
        }
        message={
          clearTargets?.length === 1
            ? `"${clearTargets[0]?.title}" will be removed from the library. The audio file stays on this device.`
            : `${clearTargets?.length ?? 0} tracks will be removed from the library. Their audio files stay on this device.`
        }
        confirmLabel={clearTargets?.length === 1 ? 'Remove' : 'Remove all'}
        destructive
        onConfirm={() => {
          const list = clearTargets;
          setClearTargets(null);
          if (list) void clearTracks(list);
        }}
        onCancel={() => setClearTargets(null)}
      />
      <ConfirmSheet
        visible={deleteTargets !== null}
        title={
          deleteTargets?.length === 1 ? 'Delete file?' : `Delete ${deleteTargets?.length ?? 0} files?`
        }
        message={
          deleteTargets?.length === 1
            ? `"${deleteTargets[0]?.title}" and its audio file will be deleted from this device. This cannot be undone.`
            : `${deleteTargets?.length ?? 0} tracks and their audio files will be deleted from this device. This cannot be undone.`
        }
        confirmLabel={deleteTargets?.length === 1 ? 'Delete file' : 'Delete files'}
        destructive
        onConfirm={() => {
          const list = deleteTargets;
          setDeleteTargets(null);
          if (list) void deleteTracks(list);
        }}
        onCancel={() => setDeleteTargets(null)}
      />
      <ConfirmSheet
        visible={excludeAllConfirm}
        title="Hide all scanned tracks?"
        message={`${scanExcludeCount} scanned tracks will be hidden from the library.`}
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
