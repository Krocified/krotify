import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  type ListViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { BackPill, HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import { buildAlbums, buildArtists, type Album, type Artist } from '../lib/groups';
import { loadArtwork } from '../library/metadata';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
  onArtworkLoaded: (trackId: string, uri: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

type Segment = 'albums' | 'artists';
type AlbumSection = { title: string; data: Album[] };

type Detail = {
  key: string;
  title: string;
  subtitle: string | null;
  meta: string;
  tracks: Track[];
  artworkHue: number;
  artworkUri?: string;
  round: boolean;
};

const BOTTOM_PAD = TAB_BAR_HEIGHT + 170;

const compareName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

export function CatalogScreen({
  tracks,
  onSelect,
  onArtworkLoaded,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const listScroll = useScrollProgress();
  const detailScroll = useScrollProgress();
  const artistListRef = useRef<FlatList<Artist>>(null);
  const detailRef = useRef<FlatList<Track>>(null);
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const [segment, setSegment] = useState<Segment>('albums');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const albums = useMemo(() => buildAlbums(tracks), [tracks]);
  const artists = useMemo(() => buildArtists(tracks), [tracks]);
  const sections = useMemo<AlbumSection[]>(() => {
    const byArtist = new Map<string, Album[]>();
    for (const album of albums) {
      const list = byArtist.get(album.artist);
      if (list) list.push(album);
      else byArtist.set(album.artist, [album]);
    }
    return [...byArtist.entries()]
      .sort(([a], [b]) => compareName(a, b))
      .map(([title, list]) => ({
        title,
        data: [...list].sort((a, b) => compareName(a.title, b.title)),
      }));
  }, [albums]);

  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 10 }), []);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      for (const { item } of viewableItems) {
        const first = (item as Album | Artist).tracks[0];
        if (!first || first.artworkUri || requested.current.has(first.id)) continue;
        requested.current.add(first.id);
        loadArtwork(first)
          .then((uri) => {
            if (uri && mounted.current) onArtworkLoaded(first.id, uri);
          })
          .catch(() => {});
      }
    },
    [onArtworkLoaded],
  );

  const detail = useMemo<Detail | null>(() => {
    if (!selectedKey) return null;
    if (segment === 'albums') {
      const album = albums.find((item) => item.key === selectedKey);
      if (!album) return null;
      const trackLabel = album.tracks.length === 1 ? 'track' : 'tracks';
      return {
        key: `album:${album.key}`,
        title: album.title,
        subtitle: album.artist,
        meta: `${album.tracks.length} ${trackLabel}`,
        tracks: album.tracks,
        artworkHue: album.artworkHue,
        artworkUri: album.tracks[0]?.artworkUri,
        round: false,
      };
    }
    const artist = artists.find((item) => item.key === selectedKey);
    if (!artist) return null;
    const albumLabel = artist.albumCount === 1 ? 'album' : 'albums';
    const trackLabel = artist.tracks.length === 1 ? 'track' : 'tracks';
    return {
      key: `artist:${artist.key}`,
      title: artist.name,
      subtitle: null,
      meta: `${artist.albumCount} ${albumLabel} · ${artist.tracks.length} ${trackLabel}`,
      tracks: artist.tracks,
      artworkHue: artist.tracks[0]?.artworkHue ?? 0,
      artworkUri: artist.tracks[0]?.artworkUri,
      round: true,
    };
  }, [albums, artists, segment, selectedKey]);

  function selectSegment(next: Segment) {
    if (next === segment) return;
    setSegment(next);
    setSelectedKey(null);
  }

  return (
    <View style={styles.root}>
      {detail ? (
        <>
          <ScreenHeader
            leading={<BackPill onPress={() => setSelectedKey(null)} />}
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <View style={{ flex: 1 }}>
            <FlatList
              ref={detailRef}
              key={detail.key}
              data={detail.tracks}
              keyExtractor={(track) => track.id}
              ListHeaderComponent={
                <View style={styles.hero}>
                  <CoverArt
                    hue={detail.artworkHue}
                    title={detail.title}
                    size={160}
                    radius={detail.round ? 80 : radius.coverLarge}
                    uri={detail.artworkUri}
                  />
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {detail.title}
                  </Text>
                  {detail.subtitle ? (
                    <Text style={styles.heroMeta} numberOfLines={1}>
                      {detail.subtitle}
                    </Text>
                  ) : null}
                  <Text style={styles.heroMeta}>{detail.meta}</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TrackRow track={item} onPress={(track) => onSelect(track, detail.tracks)} />
              )}
              showsVerticalScrollIndicator={false}
              {...detailScroll.scrollHandlers}
              contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={21}
              removeClippedSubviews={false}
            />
            <ScrollBar
              scrollY={detailScroll.scrollY}
              contentHeight={detailScroll.contentHeight}
              viewportHeight={detailScroll.viewportHeight}
              bottomOffset={bottomOffset}
              onScrollTo={(offset) =>
                detailRef.current?.scrollToOffset({ offset, animated: false })
              }
            />
          </View>
        </>
      ) : (
        <>
          <ScreenHeader
            leading={<Ionicons name="albums-outline" size={26} color={colors.text} />}
            title="Catalog"
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <View style={styles.segments}>
            <SegmentButton
              label="Albums"
              selected={segment === 'albums'}
              onPress={() => selectSegment('albums')}
            />
            <SegmentButton
              label="Artists"
              selected={segment === 'artists'}
              onPress={() => selectSegment('artists')}
            />
          </View>
          <View style={{ flex: 1 }}>
            {segment === 'albums' ? (
              <SectionList
                key="albums"
                sections={sections}
                keyExtractor={(album) => album.key}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                )}
                renderItem={({ item }) => (
                  <AlbumRow
                    album={item}
                    uri={item.tracks[0]?.artworkUri}
                    onPress={() => setSelectedKey(item.key)}
                  />
                )}
                showsVerticalScrollIndicator={false}
                {...listScroll.scrollHandlers}
                contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={21}
                removeClippedSubviews={false}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                }
              />
            ) : (
              <FlatList
                ref={artistListRef}
                key="artists"
                data={artists}
                keyExtractor={(artist) => artist.key}
                showsVerticalScrollIndicator={false}
                {...listScroll.scrollHandlers}
                contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                renderItem={({ item }) => (
                  <ArtistRow artist={item} onPress={() => setSelectedKey(item.key)} />
                )}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                }
              />
            )}
            <ScrollBar
              scrollY={listScroll.scrollY}
              contentHeight={listScroll.contentHeight}
              viewportHeight={listScroll.viewportHeight}
              bottomOffset={bottomOffset}
              onScrollTo={
                segment === 'artists'
                  ? (offset) =>
                      artistListRef.current?.scrollToOffset({ offset, animated: false })
                  : undefined
              }
            />
          </View>
        </>
      )}
    </View>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.segment,
        selected && styles.segmentActive,
        pressed && styles.segmentPressed,
      ]}
    >
      <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>{label}</Text>
    </Pressable>
  );
}

type AlbumRowProps = {
  album: Album;
  uri?: string;
  onPress: () => void;
};

function AlbumRow({ album, uri, onPress }: AlbumRowProps) {
  const trackLabel = album.tracks.length === 1 ? 'track' : 'tracks';
  const minutes = Math.round(
    album.tracks.reduce((sum, track) => sum + (track.durationMs || 0), 0) / 60000,
  );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${album.title} by ${album.artist}, ${album.tracks.length} ${trackLabel}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <CoverArt
        hue={album.artworkHue}
        title={album.title}
        size={64}
        radius={4}
        uri={uri}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {album.tracks.length} {trackLabel} · {minutes} min
        </Text>
      </View>
    </Pressable>
  );
}

function ArtistRow({ artist, onPress }: { artist: Artist; onPress: () => void }) {
  const albumLabel = artist.albumCount === 1 ? 'album' : 'albums';
  const trackLabel = artist.tracks.length === 1 ? 'track' : 'tracks';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${artist.albumCount} ${albumLabel}, ${artist.tracks.length} ${trackLabel}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <CoverArt
        hue={artist.tracks[0]?.artworkHue ?? 0}
        title={artist.name}
        size={48}
        radius={24}
        uri={artist.tracks[0]?.artworkUri}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {artist.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {artist.albumCount} {albumLabel} · {artist.tracks.length} {trackLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  segments: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: 4,
    gap: 4,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentActive: {
    backgroundColor: colors.surfaceHi,
  },
  segmentPressed: {
    opacity: 0.8,
  },
  segmentLabel: {
    ...type.meta,
    color: colors.textDim,
  },
  segmentLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  row: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  sectionTitle: {
    ...type.meta,
    color: colors.textDim,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  hero: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },
  heroTitle: {
    ...type.display,
    color: colors.text,
    textAlign: 'center',
    marginTop: space.sm,
  },
  heroMeta: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
});
