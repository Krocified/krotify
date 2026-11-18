import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type SelectionAction = {
  key: string;
  label: string;
  icon: IconName;
  tone?: 'destructive';
  disabled?: boolean;
  onPress: () => void;
};

type Props = {
  count: number;
  actions: SelectionAction[];
  onCancel: () => void;
};

export function SelectionBar({ count, actions, onCancel }: Props) {
  return (
    <View style={styles.bar}>
      <Text style={styles.count}>{count} selected</Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            disabled={action.disabled}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: action.disabled }}
            style={({ pressed }) => [
              styles.action,
              action.disabled && styles.disabled,
              pressed && !action.disabled && styles.pressed,
            ]}
          >
            <Ionicons
              name={action.icon}
              size={18}
              color={action.tone === 'destructive' ? colors.danger : colors.text}
            />
            <Text
              style={[
                styles.actionText,
                action.tone === 'destructive' && styles.actionTextDanger,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel selection"
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
  },
  count: {
    ...type.meta,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  action: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  actionText: {
    ...type.meta,
    color: colors.text,
  },
  actionTextDanger: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  cancel: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  cancelText: {
    ...type.meta,
    color: colors.textDim,
  },
  pressed: {
    opacity: 0.7,
  },
});
