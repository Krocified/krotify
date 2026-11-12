import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';

type Props = {
  leading: ReactNode;
  title?: string;
  trailing?: ReactNode;
};

type ActionsProps = {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

export function ScreenHeader({ leading, title, trailing }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        <View style={styles.leading}>
          {leading}
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

export function HeaderActions({ onOpenSearch, onOpenSettings }: ActionsProps) {
  return (
    <>
      <Pressable
        onPress={onOpenSearch}
        accessibilityRole="button"
        accessibilityLabel="Search"
        hitSlop={space.sm}
        style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
      >
        <Ionicons name="search-outline" size={22} color={colors.textDim} />
      </Pressable>
      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={space.sm}
        style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
      >
        <Ionicons name="settings-outline" size={22} color={colors.textDim} />
      </Pressable>
    </>
  );
}

type BackPillProps = {
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  label?: string;
};

export function BackPill({ onPress, icon = 'arrow-back', label = 'Back' }: BackPillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.sm}
      style={({ pressed }) => [styles.backPill, pressed && styles.backPillPressed]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
    ...type.display,
    color: colors.text,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconPressed: {
    backgroundColor: colors.surfaceHi,
  },
  backPill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surfaceHi,
  },
  backPillPressed: {
    opacity: 0.7,
  },
});
