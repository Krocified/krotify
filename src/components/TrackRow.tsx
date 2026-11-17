import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../lib/format';
import { isMissingTrack } from '../lib/settingsView';
import { colors, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';

type Props = {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress?: () => void;
  onMore?: () => void;
};

export function TrackRow({ track, onPress, onLongPress, onMore }: Props) {
  const duration = formatDuration(track.durationMs);
  const missing = isMissingTrack(track);
  const detail = missing ? 'File missing' : track.artist ? `${track.artist} · ${duration}` : duration;
  const label = `${track.title}, ${detail}`;
  const meta = track.artist ? `${track.artist} · ${duration}` : duration;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onPress(track)}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={missing ? `${label}, file missing` : label}
        accessibilityHint={onLongPress ? 'Long press for track options' : undefined}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
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
          {missing ? (
            <View style={styles.missing}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.missingText} numberOfLines={1}>
                File missing
              </Text>
            </View>
          ) : (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </Pressable>
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${track.title}`}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  main: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
  meta: {
    ...type.meta,
    color: colors.textDim,
  },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  missingText: {
    ...type.meta,
    color: colors.danger,
  },
  more: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  morePressed: {
    backgroundColor: colors.surfaceHi,
  },
});
