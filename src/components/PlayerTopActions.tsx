import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState, type ComponentProps, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SleepState } from '../player/PlayerProvider';
import type { SleepPreset } from '../lib/sleepTimer';
import { colors, radius, space, type } from '../theme';
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
    ...(onDetails
      ? [
          {
            key: 'details',
            label: 'Details',
            icon: 'information-circle-outline' as IconName,
            onPress: () => onDetails(),
          },
        ]
      : []),
    { key: 'tags', label: 'Tags', icon: 'pricetags-outline', onPress: onTags },
    { key: 'playlist', label: 'Add to playlist', icon: 'bookmark-outline', onPress: onPlaylist },
    {
      key: 'sleep',
      label: 'Sleep timer',
      icon: 'moon-outline',
      onPress: () => setSleepOpen((value) => !value),
    },
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
            style={styles.menu}
            contentStyle={styles.menuContent}
            blurTarget={blurTarget}
            intensity={40}
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
                  styles.menuRow,
                  pressed && styles.menuPressed,
                ]}
              >
                <View style={styles.menuIcon}>
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={action.key === 'sleep' && sleepOpen ? colors.accent : colors.textDim}
                  />
                </View>
                <Text style={styles.menuLabel}>{action.label}</Text>
                {action.key === 'sleep' ? (
                  <Ionicons
                    name={sleepOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textDim}
                  />
                ) : null}
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
    width: 176,
    alignItems: 'stretch',
    gap: space.xs,
  },
  menu: {
    borderRadius: 18,
  },
  menuContent: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingVertical: space.xs,
  },
  menuRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
  menuIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPressed: {
    backgroundColor: '#ffffff10',
  },
  menuLabel: {
    ...type.meta,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: 2 }],
  },
  sleepPanel: {
    alignSelf: 'stretch',
    padding: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.bg,
  },
});
