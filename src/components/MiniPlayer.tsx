import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../player/PlayerProvider';
import { colors, space, type } from '../theme';
import { CoverArt } from './CoverArt';

type Props = {
  onExpand: () => void;
};

export function MiniPlayer({ onExpand }: Props) {
  const { track, isPlaying, positionMs, durationMs, toggle } = usePlayer();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
    Animated.timing(progress, {
      toValue: ratio,
      duration: 500,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [positionMs, durationMs, progress]);

  if (!track) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={styles.progressTrack} pointerEvents="none">
        <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
      </View>
      <View style={styles.bar}>
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel="Open now playing"
          style={({ pressed }) => [styles.expand, pressed && styles.pressed]}
        >
          <CoverArt hue={track.artworkHue} title={track.title} size={44} radius={4} />
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
        </Pressable>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceHi,
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#ffffff1f',
  },
  progressFill: {
    width: '100%',
    height: 2,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  bar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.sm,
  },
  expand: {
    flex: 1,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.md,
  },
  pressed: {
    backgroundColor: '#262633',
  },
  title: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  togglePressed: {
    backgroundColor: '#ffffff14',
  },
});
