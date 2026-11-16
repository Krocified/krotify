import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { tagBarVisible, visibleTags, type TagCount } from '../tags/filter';
import { colors, space, type } from '../theme';

type Props = {
  tags: TagCount[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function TagFilterBar({ tags, selectedId, onSelect }: Props) {
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
          <Pressable
            key={item.id ?? 'all'}
            onPress={() => onSelect(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={
              item.id === null ? 'Show all tracks' : `Filter by ${item.name}`
            }
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={styles.label}>{item.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    gap: space.sm,
  },
  chip: {
    height: 34,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceHi,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.8,
  },
  label: {
    ...type.meta,
    color: colors.text,
  },
});
