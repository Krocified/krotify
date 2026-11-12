import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ReactNode } from 'react';
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

export function BackPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={space.sm}
      style={({ pressed }) => [styles.backPill, pressed && styles.backPillPressed]}
    >
      <Ionicons name="arrow-back" size={22} color={colors.text} />
      <Text style={styles.backText}>Back</Text>
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
    gap: space.xs,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surfaceHi,
  },
  backPillPressed: {
    opacity: 0.7,
  },
  backText: {
    ...type.meta,
    color: colors.text,
  },
});
