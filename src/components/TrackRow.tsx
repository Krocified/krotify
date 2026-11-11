import { Pressable, StyleSheet, Text } from 'react-native';
import { formatDuration } from '../lib/format';
import { colors, space, type } from '../theme';
import { Track } from '../types';
import { CoverArt } from './CoverArt';

type Props = {
  track: Track;
  onPress: (track: Track) => void;
};

export function TrackRow({ track, onPress }: Props) {
  const duration = formatDuration(track.durationMs);
  return (
    <Pressable
      onPress={() => onPress(track)}
      accessibilityRole="button"
      accessibilityLabel={`${track.title} by ${track.artist}, ${duration}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <CoverArt hue={track.artworkHue} title={track.title} size={56} radius={4} />
      <Text style={styles.title} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={styles.duration}>{duration}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  title: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  duration: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
});
