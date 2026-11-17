import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Playlist } from '../db/repo';
import { colors, radius, space, type } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function PlaylistActionsSheet({
  visible,
  playlist,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  function choose(action: () => void) {
    if (!playlist) return;
    onClose();
    action();
  }

  return (
    <Sheet visible={visible} title={playlist?.name} onClose={onClose}>
      <View style={styles.list}>
        <Pressable
          onPress={() => choose(onEdit)}
          accessibilityRole="button"
          accessibilityLabel="Edit playlist"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="pencil" size={22} color={colors.text} />
          <Text style={styles.label}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => choose(onDelete)}
          accessibilityRole="button"
          accessibilityLabel="Delete playlist"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <Text style={[styles.label, styles.destructive]}>Delete</Text>
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
  label: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  destructive: {
    color: colors.danger,
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
