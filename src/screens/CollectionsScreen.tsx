import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { ArtworkSourceSheet } from '../components/ArtworkSourceSheet';
import { CollectionHero } from '../components/CollectionHero';
import { PlaylistCreateSheet } from '../components/PlaylistCreateSheet';
import { PlaylistShelf } from '../components/PlaylistShelf';
import { SquareImageCropper } from '../components/SquareImageCropper';
import { CoverArt } from '../components/CoverArt';
import { MarqueeText } from '../components/MarqueeText';
import { BackPill, HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { MINI_PLAYER_HEIGHT } from '../components/MiniPlayer';
import { TrackRow } from '../components/TrackRow';
import type { PlaylistSummary } from '../db/repo';
import { applyArtistArt, artistArtKey, artistSongsLabel } from '../lib/artistIdentity';
import { validateArtworkInput } from '../lib/artworkInput';
import { buildArtists } from '../lib/groups';
import { selectionBackHandler } from '../lib/selection';
import { clearArtistArt, listArtistArt, saveArtistArt } from '../library/artistArtwork';
import { pickImageFromFiles, pickImageFromGallery } from '../library/imageInput';
import { colors, space, type } from '../theme';
import { ui } from '../ui/styles';
import type { Track } from '../types';

type Props = {
  visible: boolean;
  tracks: Track[];
  likedCount: number;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenLiked: () => void;
  onOpenPlaylists: () => void;
  onOpenPlaylist?: (id: string) => void;
  playlists?: PlaylistSummary[];
  onPlaylistsChanged?: () => void;
  onPlay: (queue: Track[]) => void;
  onSelect: (track: Track, queue: Track[]) => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
};

type Selection = { kind: 'artist'; key: string };

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function artistMeta(artist: { tracks: unknown[] }): string {
  return artistSongsLabel(artist.tracks.length);
}

export function CollectionsScreen({
  visible,
  tracks,
  likedCount,
  onOpenSearch,
  onOpenSettings,
  onOpenLiked,
  onOpenPlaylists,
  onOpenPlaylist,
  playlists = [],
  onPlaylistsChanged,
  onPlay,
  onSelect,
  registerBackInterceptor,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [artistCovers, setArtistCovers] = useState<ReadonlyMap<string, string>>(new Map());
  const [sourceOpen, setSourceOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [coverMessage, setCoverMessage] = useState<string | null>(null);
  const artists = useMemo(
    () => applyArtistArt(buildArtists(tracks), artistCovers),
    [tracks, artistCovers],
  );

  const artist = selection?.kind === 'artist'
    ? artists.find((item) => item.key === selection.key) ?? null
    : null;
  const detail = artist;
  const detailTitle = artist ? artist.name : '';
  const detailMeta = artist ? artistMeta(artist) : '';
  const detailTracks = useMemo(() => (artist ? artist.tracks : []), [artist]);
  const detailHue = artist?.tracks[0]?.artworkHue ?? 0;

  const bottomPad =
    TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + MINI_PLAYER_HEIGHT + insets.bottom + space.xl;
  const selectTrack = useCallback(
    (track: Track) => onSelect(track, detailTracks),
    [detailTracks, onSelect],
  );

  useEffect(() => {
    let cancelled = false;
    listArtistArt()
      .then((covers) => {
        if (!cancelled) setArtistCovers(covers);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!registerBackInterceptor) return;
    registerBackInterceptor(
      selectionBackHandler(selection !== null, () => setSelection(null)),
    );
    return () => registerBackInterceptor(null);
  }, [registerBackInterceptor, selection]);

  async function pickCover(source: 'gallery' | 'files') {
    setCoverMessage(null);
    try {
      const picked =
        source === 'gallery' ? await pickImageFromGallery() : await pickImageFromFiles();
      if (!picked) return;
      const validation = validateArtworkInput({
        mimeType: picked.mimeType,
        sizeBytes: picked.sizeBytes,
      });
      if (!validation.ok) {
        setCoverMessage(validation.errors.join(' '));
        return;
      }
      setCropUri(picked.uri);
    } catch {
      setCoverMessage('Could not open the cover picker.');
    }
  }

  async function handleCropDone(file: File) {
    setCropUri(null);
    if (!artist) return;
    try {
      const uri = await saveArtistArt(artistArtKey(artist.name), file);
      setArtistCovers((previous) =>
        new Map(previous).set(artistArtKey(artist.name), uri),
      );
      setCoverMessage(null);
    } catch {
      setCoverMessage('Could not save the cover.');
    } finally {
      try {
        new File(file.uri).delete();
      } catch {}
    }
  }

  async function resetCover() {
    if (!artist) return;
    const key = artistArtKey(artist.name);
    try {
      await clearArtistArt(key);
      setArtistCovers((previous) => {
        const next = new Map(previous);
        next.delete(key);
        return next;
      });
      setCoverMessage(null);
    } catch {
      setCoverMessage('Could not restore the default cover.');
    }
  }

  return (
    <View
      style={[ui.overlay, !visible && ui.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <ScreenHeader
        leading={
          selection ? (
            <BackPill onPress={() => setSelection(null)} label="Back to collections" />
          ) : (
            <Ionicons name="albums-outline" size={26} color={colors.text} />
          )
        }
        title={detail ? undefined : 'Collections'}
        trailing={
          selection ? undefined : (
            <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
          )
        }
      />

      {detail ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          <CollectionHero
            title={detailTitle}
            meta={detailMeta}
            artworkUri={artist?.artworkUri ?? detailTracks[0]?.artworkUri}
            fallbackHue={detailHue}
            onPlay={() => onPlay(detailTracks)}
            onShuffle={() => onPlay(shuffle(detailTracks))}
            onPressArtwork={() => setSourceOpen(true)}
            disabled={detailTracks.length === 0}
          />
          {coverMessage ? <Text style={styles.coverMessage}>{coverMessage}</Text> : null}
          <View style={styles.list}>
            {detailTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                onPress={selectTrack}
                showArtist={false}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          <View style={[ui.content, { paddingTop: space.sm }]}>
            <View>
              <Pressable
                onPress={onOpenLiked}
                accessibilityRole="button"
                accessibilityLabel={`Liked Songs, ${countLabel(likedCount, 'song')}`}
                style={({ pressed }) => [styles.row, styles.likedRow, pressed && ui.rowPressed]}
              >
                <View style={styles.likedIcon}>
                  <Ionicons name="heart" size={22} color={colors.text} />
                </View>
                <View style={styles.rowText}>
                  <Text style={ui.rowTitle}>Liked Songs</Text>
                  <Text style={ui.rowMeta}>{countLabel(likedCount, 'song')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
              </Pressable>
            </View>
          </View>

          <PlaylistShelf
            playlists={playlists}
            onCreate={() => setCreateOpen(true)}
            onOpen={(id) => onOpenPlaylist?.(id)}
            onViewAll={onOpenPlaylists}
          />

          <View style={[ui.content, { paddingTop: space.xs, gap: space.xs }]}>
            <Text style={ui.sectionTitle}>Artists</Text>
            {artists.length === 0 ? (
              <Text style={styles.empty}>No artists yet.</Text>
            ) : (
              artists.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setSelection({ kind: 'artist', key: item.key })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${artistMeta(item)}`}
                  style={({ pressed }) => [styles.row, styles.artistRow, pressed && ui.rowPressed]}
                >
                  <CoverArt
                    hue={item.tracks[0]?.artworkHue ?? 0}
                    title={item.name}
                    size={48}
                    radius={24}
                    uri={item.artworkUri ?? item.tracks[0]?.artworkUri}
                  />
                  <View style={styles.rowText}>
                    <MarqueeText text={item.name} style={ui.rowTitle} />
                    <Text style={ui.rowMeta}>{artistMeta(item)}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
      <PlaylistCreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          onPlaylistsChanged?.();
        }}
      />
      <ArtworkSourceSheet
        visible={sourceOpen}
        canRemove={Boolean(artist?.artworkUri)}
        onGallery={() => void pickCover('gallery')}
        onFiles={() => void pickCover('files')}
        onRemove={() => void resetCover()}
        onClose={() => setSourceOpen(false)}
      />
      <SquareImageCropper
        visible={cropUri !== null}
        uri={cropUri}
        onCancel={() => setCropUri(null)}
        onDone={(file) => void handleCropDone(file)}
      />
    </View>
  );
}

function shuffle(queue: Track[]): Track[] {
  const copy = [...queue];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as Track, copy[index] as Track];
  }
  return copy;
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 0,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - space.xs,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  likedRow: {
    borderBottomWidth: 0,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
  },
  artistRow: {
    minHeight: 48,
    paddingVertical: space.xs,
    borderBottomWidth: 0,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
  },
  likedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  coverMessage: {
    ...type.meta,
    color: colors.danger,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    paddingVertical: space.sm,
  },
});
