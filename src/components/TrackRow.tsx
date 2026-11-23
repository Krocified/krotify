import { Ionicons } from '@react-native-vector-icons/ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../lib/format';
import { isMissingTrack } from '../lib/settingsView';
import { colors, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';
import { MarqueeText } from './MarqueeText';

type Props = {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress?: (track: Track) => void;
  onMore?: (track: Track) => void;
  selectionMode?: boolean;
  selected?: boolean;
  disabled?: boolean;
  showArtist?: boolean;
};

export const TrackRow = memo(function TrackRow({
  track,
  onPress,
  onLongPress,
  onMore,
  selectionMode = false,
  selected = false,
  disabled = false,
  showArtist = true,
}: Props) {
  const duration = formatDuration(track.durationMs);
  const missing = isMissingTrack(track);
  const artistMeta = showArtist && track.artist ? `${track.artist} · ${duration}` : duration;
  const detail = missing ? 'File missing' : artistMeta;
  const label = `${track.title}, ${detail}`;
  const meta = artistMeta;

  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <Pressable
        onPress={() => {
          if (!disabled) onPress(track);
        }}
        onLongPress={() => onLongPress?.(track)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={missing ? `${label}, file missing` : label}
        accessibilityHint={onLongPress ? 'Long press for track options' : undefined}
        accessibilityState={
          selectionMode || disabled
            ? { selected: disabled ? true : selected, disabled }
            : undefined
        }
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <CoverArt
          hue={track.artworkHue}
          title={track.title}
          size={52}
          radius={4}
          uri={track.artworkUri}
        />
        <View style={styles.text}>
          <MarqueeText text={track.title} style={styles.title} />
          {missing ? (
            <View style={styles.missing}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.missingText} numberOfLines={1}>
                File missing
              </Text>
            </View>
          ) : (
            <MarqueeText text={meta} style={styles.meta} />
          )}
        </View>
      </Pressable>
      {selectionMode ? (
        <View style={styles.more}>
          <Ionicons
            name={disabled ? 'checkmark-circle' : selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={disabled ? colors.textDim : selected ? colors.accent : colors.textDim}
          />
        </View>
      ) : onMore ? (
        <Pressable
          onPress={() => onMore(track)}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${track.title}`}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  rowDisabled: {
    opacity: 0.45,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  main: {
    flex: 1,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - space.xs,
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
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.xs,
  },
  morePressed: {
    opacity: 0.5,
  },
});
