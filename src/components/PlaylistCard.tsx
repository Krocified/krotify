import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { PlaylistSummary } from '../db/repo';
import { hueFromSeed } from '../lib/hash';
import { colors, radius, space, type } from '../theme';
import { CoverArt } from './CoverArt';

type Props = {
  summary: PlaylistSummary;
  onOpen: () => void;
  onMenu: () => void;
};

export function PlaylistCard({ summary, onOpen, onMenu }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - space.md * 3) / 2);
  const count = summary.trackCount;
  const meta = `${count} ${count === 1 ? 'song' : 'songs'}`;

  return (
    <View style={[styles.card, { width: size }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${summary.name}`}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <CoverArt
          hue={hueFromSeed(summary.id + summary.name)}
          title={summary.name}
          size={size}
          radius={radius.coverLarge}
          uri={summary.artworkUri ?? summary.firstArtworkUri}
        />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {summary.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${summary.name}`}
        hitSlop={4}
        style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
  },
  text: {
    paddingTop: space.sm,
    gap: 2,
  },
  name: {
    ...type.body,
    color: colors.text,
  },
  meta: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  menu: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pressed: {
    opacity: 0.75,
  },
});
