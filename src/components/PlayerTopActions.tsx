import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SleepState } from '../player/PlayerProvider';
import type { SleepPreset } from '../lib/sleepTimer';
import { colors, radius, space, type } from '../theme';
import { SleepTimerControls } from './SleepTimerControls';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  liked: boolean;
  onToggleLike: () => void;
  lyricsEnabled: boolean;
  lyricsMode: boolean;
  onToggleLyrics: () => void;
  sleep: SleepState;
  onSelectSleep: (preset: SleepPreset) => void;
  onCancelSleep: () => void;
  onTags: () => void;
  onPlaylist: () => void;
  onDetails?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PlayerTopActions({
  liked,
  onToggleLike,
  lyricsEnabled,
  lyricsMode,
  onToggleLyrics,
  sleep,
  onSelectSleep,
  onCancelSleep,
  onTags,
  onPlaylist,
  onDetails,
  open,
  onOpenChange,
}: Props) {
  const secondary: { key: string; label: string; icon: IconName; onPress: () => void }[] = [
    { key: 'sleep', label: 'Sleep timer', icon: 'moon-outline', onPress: () => {} },
    { key: 'tags', label: 'Tags', icon: 'pricetags-outline', onPress: onTags },
    { key: 'playlist', label: 'Save to playlist', icon: 'bookmark-outline', onPress: onPlaylist },
    ...(onDetails
      ? [{ key: 'details', label: 'Details', icon: 'information-circle-outline' as IconName, onPress: () => onDetails() }]
      : []),
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onToggleLike}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          accessibilityState={{ selected: liked }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? colors.accent : colors.textDim}
          />
        </Pressable>
        {lyricsEnabled ? (
          <Pressable
            onPress={onToggleLyrics}
            accessibilityRole="button"
            accessibilityLabel="Lyrics"
            accessibilityState={{ selected: lyricsMode }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={lyricsMode ? colors.accent : colors.textDim}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onOpenChange(!open)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide more actions' : 'More player actions'}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={open ? 'chevron-up' : 'ellipsis-vertical'}
            size={22}
            color={open ? colors.text : colors.textDim}
          />
        </Pressable>
      </View>

      {open ? (
        <>
          <View style={styles.secondaryRow}>
            {secondary.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  action.onPress();
                  if (action.key !== 'sleep') onOpenChange(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              >
                <Ionicons name={action.icon} size={16} color={colors.text} />
                <Text style={styles.pillText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sleepPanel}>
            <SleepTimerControls
              mode={sleep.mode}
              remainingMs={sleep.remainingMs}
              onSelect={(preset) => {
                onSelectSleep(preset);
                onOpenChange(false);
              }}
              onCancel={onCancelSleep}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  iconButton: {
    height: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: {
    backgroundColor: '#ffffff14',
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.screen,
    backgroundColor: '#ffffff14',
  },
  pillText: {
    ...type.meta,
    color: colors.text,
  },
  sleepPanel: {
    alignSelf: 'stretch',
    padding: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
});
