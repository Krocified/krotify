import { Ionicons } from '@react-native-vector-icons/ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { PlaylistSummary } from '../db/repo';
import { hueFromSeed } from '../lib/hash';
import { colors, radius, space, type } from '../theme';
import { CoverArt } from './CoverArt';
import { MarqueeText } from './MarqueeText';

type Props = {
  summary: PlaylistSummary;
  onOpen: (id: string) => void;
  onMenu?: (playlist: PlaylistSummary) => void;
};

export const PlaylistCard = memo(function PlaylistCard({ summary, onOpen, onMenu }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - space.md * 3) / 2);
  const count = summary.trackCount;
  const meta = `${count} ${count === 1 ? 'song' : 'songs'}`;

  return (
    <View style={[styles.card, { width: size }]}>
      <Pressable
        onPress={() => onOpen(summary.id)}
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
          <MarqueeText text={summary.name} style={styles.name} />
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      {onMenu ? (
        <Pressable
          onPress={() => onMenu(summary)}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${summary.name}`}
          hitSlop={4}
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
});

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
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});
