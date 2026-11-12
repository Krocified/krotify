import { Ionicons } from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecentlyPlayed } from '../components/RecentlyPlayed';
import { ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { colors, space, type } from '../theme';
import type { LibraryStatus, Track } from '../types';

type Props = {
  tracks: Track[];
  recentTracks: Track[];
  status: LibraryStatus;
  statusNote: string | null;
  onSelect: (track: Track, queue: Track[]) => void;
  onManage: (track: Track) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

const STATUS_NOTE: Partial<Record<LibraryStatus, string>> = {
  denied: 'Showing demo tracks. Allow audio access in Settings.',
  empty: 'No audio files found. Showing demo tracks.',
  error: 'Could not read your library. Showing demo tracks.',
};

export function LibraryScreen({
  tracks,
  recentTracks,
  status,
  statusNote,
  onSelect,
  onManage,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const statusMessage = STATUS_NOTE[status] ?? null;

  return (
    <View style={styles.root}>
      <ScreenHeader
        leading={
          <>
            <Image
              source={require('../../assets/lyrics.png')}
              style={styles.brandIcon}
              accessible={false}
            />
            <Text style={styles.wordmark}>Krotify</Text>
          </>
        }
        trailing={
          <>
            <Pressable
              onPress={onOpenSearch}
              accessibilityRole="button"
              accessibilityLabel="Search"
              hitSlop={space.sm}
              style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
            >
              <Ionicons name="search-outline" size={22} color={colors.textDim} />
            </Pressable>
            <Pressable
              onPress={onOpenSettings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={space.sm}
              style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textDim} />
            </Pressable>
          </>
        }
      />

      {status === 'scanning' ? (
        <View style={styles.scanning}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.scanningText}>Scanning your library…</Text>
        </View>
      ) : (
        <>
          {statusMessage ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>{statusMessage}</Text>
            </View>
          ) : null}
          {statusNote ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>{statusNote}</Text>
            </View>
          ) : null}
          <FlatList
            data={tracks}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => (
              <TrackRow
                track={item}
                onPress={(track) => onSelect(track, tracks)}
                onLongPress={() => onManage(item)}
              />
            )}
            ListHeaderComponent={
              recentTracks.length > 0 ? (
                <RecentlyPlayed tracks={recentTracks} onSelect={onSelect} />
              ) : undefined
            }
            initialNumToRender={16}
            windowSize={9}
            removeClippedSubviews
            contentContainerStyle={{ paddingBottom: 66 + TAB_BAR_HEIGHT + insets.bottom }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  brandIcon: {
    width: 26,
    height: 26,
  },
  wordmark: {
    ...type.display,
    color: colors.text,
    letterSpacing: -0.5,
  },
  gear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  gearPressed: {
    backgroundColor: colors.surfaceHi,
  },
  scanning: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  scanningText: {
    ...type.meta,
    color: colors.textDim,
  },
  note: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  noteText: {
    ...type.meta,
    color: colors.textDim,
  },
});
