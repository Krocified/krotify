import { Ionicons } from '@react-native-vector-icons/ionicons';
import { BlurView } from 'expo-blur';
import type { ComponentProps, ComponentRef, RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';

export type TabName = 'library' | 'catalog' | 'import';

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_BOTTOM_GAP = 12;

type Props = {
  active: TabName;
  onSelect: (tab: TabName) => void;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: TabName; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'library', label: 'Library', icon: 'library-outline', iconActive: 'library' },
  { name: 'catalog', label: 'Catalog', icon: 'albums-outline', iconActive: 'albums' },
  { name: 'import', label: 'Import', icon: 'download-outline', iconActive: 'download' },
];

export function TabBar({ active, onSelect, blurTarget }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + TAB_BAR_BOTTOM_GAP }]}>
      <View style={styles.shadow}>
        <View style={styles.pill}>
          <View pointerEvents="none" style={styles.fill} />
          <BlurView
            pointerEvents="none"
            intensity={50}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />
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
                    name={selected ? tab.iconActive : tab.icon}
                    size={24}
                    color={selected ? colors.text : colors.textDim}
                  />
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
  },
  shadow: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  pill: {
    flex: 1,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#ffffff14',
    overflow: 'hidden',
    backgroundColor: 'rgba(22,22,29,0.55)',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(22,22,29,0.35)',
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
  label: {
    ...type.meta,
    fontSize: 11,
    fontWeight: '500',
  },
});
