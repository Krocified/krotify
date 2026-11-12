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
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import { buildAlbums, type Album } from '../lib/groups';
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

const BOTTOM_PAD = TAB_BAR_HEIGHT + 170;

type AlbumSection = { title: string; data: Album[] };

const compareName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

export function AlbumsScreen({
  tracks,
  onSelect,
  onArtworkLoaded,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const listScroll = useScrollProgress();
  const detailScroll = useScrollProgress();
  const detailRef = useRef<FlatList<Track>>(null);
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + 8;
  const albums = useMemo(() => buildAlbums(tracks), [tracks]);
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
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
        const first = (item as Album).tracks[0];
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

  const selected = selectedKey ? albums.find((album) => album.key === selectedKey) : null;
  const closeDetail = () => setSelectedKey(null);

  const trackLabel = selected && selected.tracks.length === 1 ? 'track' : 'tracks';

  return (
    <View style={styles.root}>
      {selected ? (
        <>
          <ScreenHeader
            leading={<BackPill onPress={closeDetail} />}
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <View style={{ flex: 1 }}>
            <FlatList
              ref={detailRef}
              key={selected.key}
              data={selected.tracks}
              keyExtractor={(track) => track.id}
              ListHeaderComponent={
                <View style={styles.hero}>
                  <CoverArt
                    hue={selected.artworkHue}
                    title={selected.title}
                    size={160}
                    radius={radius.coverLarge}
                    uri={selected.tracks[0]?.artworkUri}
                  />
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {selected.title}
                  </Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {selected.artist}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {selected.tracks.length} {trackLabel}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TrackRow track={item} onPress={(track) => onSelect(track, selected.tracks)} />
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
            title="Albums"
            trailing={
              <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
            }
          />
          <View style={{ flex: 1 }}>
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
            <ScrollBar
              scrollY={listScroll.scrollY}
              contentHeight={listScroll.contentHeight}
              viewportHeight={listScroll.viewportHeight}
              bottomOffset={bottomOffset}
            />
          </View>
        </>
      )}
    </View>
  );
}

type RowProps = {
  album: Album;
  uri?: string;
  onPress: () => void;
};

function AlbumRow({ album, uri, onPress }: RowProps) {
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

const styles = StyleSheet.create({
  empty: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
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
