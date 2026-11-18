import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  canRemove?: boolean;
  onGallery: () => void;
  onFiles: () => void;
  onRemove?: () => void;
  onClose: () => void;
};

export function ArtworkSourceSheet({
  visible,
  canRemove = false,
  onGallery,
  onFiles,
  onRemove,
  onClose,
}: Props) {
  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <Sheet visible={visible} title="Cover art" onClose={onClose}>
      <Pressable
        onPress={() => run(onGallery)}
        accessibilityRole="button"
        accessibilityLabel="Choose from gallery"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name="images-outline" size={22} color={colors.text} />
        <Text style={styles.label}>Gallery</Text>
      </Pressable>
      <Pressable
        onPress={() => run(onFiles)}
        accessibilityRole="button"
        accessibilityLabel="Choose from files"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name="folder-open-outline" size={22} color={colors.text} />
        <Text style={styles.label}>Files</Text>
      </Pressable>
      {canRemove && onRemove ? (
        <Pressable
          onPress={() => run(onRemove)}
          accessibilityRole="button"
          accessibilityLabel="Remove cover"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
          <Text style={[styles.label, styles.danger]}>Remove cover</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text,
  },
  danger: {
    color: colors.danger,
  },
});
