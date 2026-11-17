import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listFavoriteIds } from '../db/repo';
import { colors, radius, space, type } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenLiked?: () => void;
  onOpenPlaylists: () => void;
};

function songCount(count: number): string {
  return `${count} ${count === 1 ? 'song' : 'songs'}`;
}

export function CollectionsSheet({ visible, onClose, onOpenLiked, onOpenPlaylists }: Props) {
  const [likedCount, setLikedCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listFavoriteIds()
      .then((ids) => {
        if (!cancelled) setLikedCount(ids.size);
      })
      .catch(() => {
        if (!cancelled) setLikedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const choose = (handler: () => void) => {
    onClose();
    handler();
  };

  return (
    <Sheet visible={visible} title="Collections" onClose={onClose}>
      <View style={styles.list}>
        {onOpenLiked ? (
          <Pressable
            onPress={() => choose(onOpenLiked)}
            accessibilityRole="button"
            accessibilityLabel={`Liked Songs, ${songCount(likedCount)}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="heart" size={22} color={colors.accent2} />
            <View style={styles.text}>
              <Text style={styles.label}>Liked Songs</Text>
              <Text style={styles.meta}>{songCount(likedCount)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => choose(onOpenPlaylists)}
          accessibilityRole="button"
          accessibilityLabel="Playlists"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="musical-notes-outline" size={22} color={colors.text} />
          <Text style={[styles.label, styles.grow]}>Playlists</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [styles.row, styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.xs,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.screen,
  },
  pressed: {
    backgroundColor: colors.surfaceHi,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...type.body,
    color: colors.text,
  },
  grow: {
    flex: 1,
  },
  meta: {
    ...type.meta,
    color: colors.textDim,
  },
  cancel: {
    justifyContent: 'center',
    marginTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff12',
    borderRadius: 0,
  },
  cancelText: {
    ...type.body,
    color: colors.textDim,
  },
});
