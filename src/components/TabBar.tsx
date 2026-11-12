import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';

export type TabName = 'library' | 'albums' | 'artists';

export const TAB_BAR_HEIGHT = 56;

type Props = {
  active: TabName;
  onSelect: (tab: TabName) => void;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'library', label: 'Library', icon: 'library-outline' },
  { name: 'albums', label: 'Albums', icon: 'albums-outline' },
  { name: 'artists', label: 'Artists', icon: 'people-outline' },
];

export function TabBar({ active, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.row}>
        {TABS.map((tab) => {
        const selected = tab.name === active;
        return (
          <Pressable
            key={tab.name}
            onPress={() => onSelect(tab.name)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            style={styles.tab}
          >
            <Ionicons
              name={tab.icon}
              size={24}
              color={selected ? colors.accent : colors.textDim}
            />
            <Text style={[styles.label, { color: selected ? colors.accent : colors.textDim }]}>
              {tab.label}
            </Text>
          </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff10',
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: {
    ...type.meta,
    fontSize: 11,
  },
});
