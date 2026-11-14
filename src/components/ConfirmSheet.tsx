import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Sheet visible={visible} title={title} onClose={onCancel}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={({ pressed }) => [
            styles.button,
            styles.confirm,
            destructive && styles.destructive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: {
    ...type.body,
    fontWeight: '400',
    color: colors.textDim,
    lineHeight: 22,
    paddingBottom: space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  button: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  confirm: {
    backgroundColor: colors.accent,
  },
  destructive: {
    backgroundColor: '#3A1418',
  },
  pressed: {
    opacity: 0.75,
  },
  cancelText: {
    ...type.body,
    color: colors.text,
  },
  confirmText: {
    ...type.body,
    color: colors.text,
  },
  destructiveText: {
    color: '#FF6B6B',
  },
});
