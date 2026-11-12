import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';

type Props = {
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
};

const SIZE = 120;

export function RecentlyPlayed({ tracks, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Recently played</Text>
      <FlatList
        horizontal
        data={tracks.slice(0, 12)}
        keyExtractor={(track) => track.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item, tracks)}
            accessibilityRole="button"
            accessibilityLabel={`Play ${item.title}`}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <CoverArt
              hue={item.artworkHue}
              title={item.title}
              size={SIZE}
              radius={radius.coverLarge}
              uri={item.artworkUri}
            />
            <Text style={styles.label} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  title: {
    ...type.body,
    color: colors.text,
    paddingHorizontal: space.md,
  },
  list: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  item: {
    width: SIZE,
    gap: space.xs,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    ...type.meta,
    color: colors.text,
  },
});
