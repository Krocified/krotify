import { Ionicons } from '@react-native-vector-icons/ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
      style={[
        styles.bar,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(11,11,15,0)', 'rgba(11,11,15,0.85)', '#0B0B0F']}
        locations={[0, 0.55, 1]}
        style={[styles.fade, { height: TAB_BAR_HEIGHT + TAB_BAR_HEIGHT / 2 + insets.bottom }]}
      />
      <View style={{ height: TAB_BAR_HEIGHT }}>
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
                <View style={[styles.pill, selected && styles.pillActive]}>
                  <Ionicons
                    name={tab.icon}
                    size={24}
                    color={selected ? colors.accent2 : colors.textDim}
                  />
                </View>
                <Text
                  style={[styles.label, { color: selected ? colors.text : colors.textDim }]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'relative',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: space.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: 'rgba(33,91,237,0.16)',
  },
  label: {
    ...type.meta,
    fontSize: 11,
    fontWeight: '500',
  },
});
