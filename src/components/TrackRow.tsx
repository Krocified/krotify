import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../lib/format';
import { colors, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';

type Props = {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress?: () => void;
};

export function TrackRow({ track, onPress, onLongPress }: Props) {
  const duration = formatDuration(track.durationMs);
  const label = track.artist
    ? `${track.title} by ${track.artist}, ${duration}`
    : `${track.title}, ${duration}`;
  return (
    <Pressable
      onPress={() => onPress(track)}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={onLongPress ? 'Long press for track options' : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <CoverArt
        hue={track.artworkHue}
        title={track.title}
        size={56}
        radius={4}
        uri={track.artworkUri}
      />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        {track.artist ? (
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
        ) : null}
      </View>
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
  text: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  artist: {
    ...type.meta,
    color: colors.textDim,
  },
  duration: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
});
