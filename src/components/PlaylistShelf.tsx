import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaylistSummary } from '../db/repo';
import { colors, radius, space, type } from '../theme';
import { PlaylistCard } from './PlaylistCard';

type Props = {
  playlists: PlaylistSummary[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onViewAll: () => void;
};

const MAX_VISIBLE = 4;

export function PlaylistShelf({ playlists, onCreate, onOpen, onViewAll }: Props) {
  const visible = playlists.slice(0, MAX_VISIBLE);
  const hasMore = playlists.length > MAX_VISIBLE;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title}>Playlists</Text>
        <View style={styles.actions}>
          {hasMore ? (
            <Pressable
              onPress={onViewAll}
              accessibilityRole="button"
              accessibilityLabel="View all playlists"
              style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}
            >
              <Text style={styles.viewAllText}>View all</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onCreate}
            accessibilityRole="button"
            accessibilityLabel="New playlist"
            hitSlop={space.xs}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="musical-notes-outline" size={22} color={colors.accent2} />
          </View>
          <View style={styles.emptyText}>
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptyMeta}>Tap the + button to create your first one.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((playlist) => (
            <PlaylistCard key={playlist.id} summary={playlist} onOpen={onOpen} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
    paddingTop: space.md,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  viewAll: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  viewAllText: {
    ...type.meta,
    color: colors.accent2,
  },
  addButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.surfaceHi,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingHorizontal: space.md,
  },
  empty: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.screen,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ffffff1f',
    backgroundColor: 'rgba(31,31,41,0.55)',
  },
  emptyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#215BED2E',
  },
  emptyText: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    ...type.body,
    color: colors.text,
  },
  emptyMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});
