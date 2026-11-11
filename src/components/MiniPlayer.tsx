import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../player/PlayerProvider';
import { colors, space, type } from '../theme';
import { CoverArt } from './CoverArt';

type Props = {
  onExpand: () => void;
};

export function MiniPlayer({ onExpand }: Props) {
  const { track, isPlaying, toggle } = usePlayer();
  const insets = useSafeAreaInsets();

  if (!track) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
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
          <Text style={styles.glyph}>{isPlaying ? '❚❚' : '▶'}</Text>
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
  glyph: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
