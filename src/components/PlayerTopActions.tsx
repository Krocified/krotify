import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState, type ComponentProps, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SleepState } from '../player/PlayerProvider';
import type { SleepPreset } from '../lib/sleepTimer';
import { colors, radius, space } from '../theme';
import { BlurPill } from './BlurPill';
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
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
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
  blurTarget,
}: Props) {
  const [sleepOpen, setSleepOpen] = useState(false);

  if (!open && sleepOpen) setSleepOpen(false);

  const secondary: { key: string; label: string; icon: IconName; onPress: () => void }[] = [
    {
      key: 'sleep',
      label: 'Sleep timer',
      icon: 'moon-outline',
      onPress: () => setSleepOpen((value) => !value),
    },
    { key: 'tags', label: 'Tags', icon: 'pricetags-outline', onPress: onTags },
    { key: 'playlist', label: 'Save to playlist', icon: 'bookmark-outline', onPress: onPlaylist },
    ...(onDetails
      ? [{ key: 'details', label: 'Details', icon: 'information-circle-outline' as IconName, onPress: () => onDetails() }]
      : []),
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <BlurPill
          onPress={onToggleLike}
          accessibilityLabel={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          accessibilityState={{ selected: liked }}
          blurTarget={blurTarget}
          intensity={35}
          style={styles.iconButton}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? colors.accent : colors.textDim}
          />
        </BlurPill>
        {lyricsEnabled ? (
          <BlurPill
            onPress={onToggleLyrics}
            accessibilityLabel="Lyrics"
            accessibilityState={{ selected: lyricsMode }}
            blurTarget={blurTarget}
            intensity={35}
            style={styles.iconButton}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={lyricsMode ? colors.accent : colors.textDim}
            />
          </BlurPill>
        ) : null}
        <BlurPill
          onPress={() => onOpenChange(!open)}
          accessibilityLabel={open ? 'Hide more actions' : 'More player actions'}
          accessibilityState={{ expanded: open }}
          blurTarget={blurTarget}
          intensity={35}
          style={styles.iconButton}
        >
          <Ionicons
            name={open ? 'chevron-up' : 'ellipsis-vertical'}
            size={22}
            color={open ? colors.text : colors.textDim}
          />
        </BlurPill>
      </View>

      {open ? (
        <View style={styles.popover}>
          <BlurPill
            style={styles.secondaryGroup}
            contentStyle={styles.secondaryRow}
            blurTarget={blurTarget}
            intensity={35}
          >
            {secondary.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  action.onPress();
                  if (action.key !== 'sleep') onOpenChange(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={action.key === 'sleep' ? { expanded: sleepOpen } : undefined}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryPressed,
                ]}
              >
                <Ionicons name={action.icon} size={20} color={colors.text} />
              </Pressable>
            ))}
          </BlurPill>
          {sleepOpen ? (
            <View style={styles.sleepPanel}>
              <SleepTimerControls
                mode={sleep.mode}
                remainingMs={sleep.remainingMs}
                onSelect={(preset) => {
                  onSelectSleep(preset);
                  setSleepOpen(false);
                  onOpenChange(false);
                }}
                onCancel={() => {
                  onCancelSleep();
                  setSleepOpen(false);
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    zIndex: 2,
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
  popover: {
    position: 'absolute',
    top: 50,
    right: 0,
    alignItems: 'flex-end',
    gap: space.xs,
  },
  secondaryGroup: {
    height: 48,
    borderRadius: 24,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  sleepPanel: {
    alignSelf: 'stretch',
    padding: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.bg,
  },
});
