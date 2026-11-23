import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SelectionState } from '../lib/selection';
import { colors, radius, space, type } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type SelectionAction = {
  key: string;
  label: string;
  icon: IconName;
  tone?: 'destructive';
  disabled?: boolean;
  iconOnly?: boolean;
  onPress: () => void;
};

type Props = {
  count: number;
  allState: SelectionState;
  onToggleAll: () => void;
  actions: SelectionAction[];
  onCancel: () => void;
};

const ALL_ICON: Record<SelectionState, IconName> = {
  none: 'square-outline',
  partial: 'remove-circle',
  all: 'checkbox',
};

export function SelectionBar({ count, allState, onToggleAll, actions, onCancel }: Props) {
  const allLabel = allState === 'all' ? 'Unselect all' : 'Select all';

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onToggleAll}
        accessibilityRole="checkbox"
        accessibilityLabel={allLabel}
        accessibilityState={{
          checked: allState === 'all' ? true : allState === 'partial' ? 'mixed' : false,
        }}
        hitSlop={space.xs}
        style={({ pressed }) => [styles.allControl, pressed && styles.pressed]}
      >
        <Ionicons
          name={ALL_ICON[allState]}
          size={24}
          color={allState === 'none' ? colors.textDim : colors.accent}
        />
        <Text style={styles.count}>{count} selected</Text>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionsScroll}
        contentContainerStyle={styles.actions}
      >
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
              action.iconOnly && styles.actionIconOnly,
              action.disabled && styles.disabled,
              pressed && !action.disabled && styles.pressed,
            ]}
          >
            <Ionicons
              name={action.icon}
              size={action.iconOnly ? 22 : 18}
              color={action.tone === 'destructive' ? colors.danger : colors.text}
            />
            {action.iconOnly ? null : (
              <Text
                style={[
                  styles.actionText,
                  action.tone === 'destructive' && styles.actionTextDanger,
                ]}
              >
                {action.label}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel selection"
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
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
  allControl: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.screen,
  },
  actionsScroll: {
    flex: 1,
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
  actionIconOnly: {
    width: 44,
    height: 44,
    minHeight: 44,
    justifyContent: 'center',
    gap: 0,
    paddingHorizontal: 0,
    borderRadius: 22,
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});
