import type { ComponentRef, RefObject } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { tagBarVisible, visibleTags, type TagCount } from '../tags/filter';
import { colors, space, type } from '../theme';
import { BlurPill } from './BlurPill';

type Props = {
  tags: TagCount[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
};

export function TagFilterBar({ tags, selectedId, onSelect, blurTarget }: Props) {
  if (!tagBarVisible(tags)) return null;

  const items: { id: string | null; name: string }[] = [
    { id: null, name: 'All' },
    ...visibleTags(tags).map((tag) => ({ id: tag.id, name: tag.name })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {items.map((item) => {
        const selected = selectedId === item.id;
        return (
          <BlurPill
            key={item.id ?? 'all'}
            onPress={() => onSelect(item.id)}
            accessibilityLabel={
              item.id === null ? 'Show all tracks' : `Filter by ${item.name}`
            }
            accessibilityState={{ selected }}
            blurTarget={blurTarget}
            intensity={35}
            fillColor={selected ? colors.accent : undefined}
            style={styles.chip}
            contentStyle={styles.chipContent}
          >
            <Text style={styles.label}>{item.name}</Text>
          </BlurPill>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.sm,
  },
  chip: {
    height: 34,
    minHeight: 34,
    borderRadius: 999,
  },
  chipContent: {
    height: '100%',
    paddingHorizontal: space.md,
  },
  label: {
    ...type.meta,
    color: colors.text,
  },
});
