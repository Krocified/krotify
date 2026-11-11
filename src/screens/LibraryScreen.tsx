import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackRow } from '../components/TrackRow';
import { colors, space, type } from '../theme';
import type { LibraryStatus, Track } from '../types';

type Props = {
  tracks: Track[];
  status: LibraryStatus;
  statusNote: string | null;
  onSelect: (track: Track) => void;
  onOpenSettings: () => void;
};

const ROW = 72 + StyleSheet.hairlineWidth;

const STATUS_NOTE: Partial<Record<LibraryStatus, string>> = {
  denied: 'Showing demo tracks. Allow audio access in Settings.',
  empty: 'No audio files found. Showing demo tracks.',
  error: 'Could not read your library. Showing demo tracks.',
};

export function LibraryScreen({ tracks, status, statusNote, onSelect, onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const note = statusNote ?? STATUS_NOTE[status] ?? null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.wordmark}>krotify</Text>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={space.sm}
          style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
        >
          <Text style={styles.gearGlyph}>⚙</Text>
        </Pressable>
      </View>

      {status === 'scanning' ? (
        <View style={styles.scanning}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.scanningText}>Scanning your library…</Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TrackRow track={item} onPress={onSelect} />}
          getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
          initialNumToRender={16}
          windowSize={9}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: 88 + insets.bottom }}
          ListHeaderComponent={
            note ? (
              <View style={styles.note}>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
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
  gearGlyph: {
    color: colors.textDim,
    fontSize: 22,
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
