import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme';
import { ui } from '../ui/styles';
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
      <View style={ui.actions}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [ui.secondaryButton, styles.button, pressed && ui.pressed]}
        >
          <Text style={ui.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={({ pressed }) => [
            ui.secondaryButton,
            styles.button,
            styles.confirm,
            destructive && styles.destructive,
            pressed && ui.pressed,
          ]}
        >
          <Text style={[ui.primaryButtonText, destructive && styles.destructiveText]}>
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
  button: {
    flex: 1,
    height: 48,
  },
  confirm: {
    backgroundColor: colors.accent,
  },
  destructive: {
    backgroundColor: '#3A1418',
  },
  destructiveText: {
    color: '#FF6B6B',
  },
});
