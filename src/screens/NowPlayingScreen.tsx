import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { ProgressBar } from '../components/ProgressBar';
import { coverColors } from '../lib/cover';
import { usePlayer } from '../player/PlayerProvider';
import { colors, radius, space, type } from '../theme';

type Props = {
  onClose: () => void;
};

const SLIDE_MS = 300;

export function NowPlayingScreen({ onClose }: Props) {
  const { track, isPlaying, positionMs, durationMs, lastError, toggle, seek } = usePlayer();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(height));
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [slide]);

  if (!track) return null;

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(slide, {
      toValue: height,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }

  const gradient = coverColors(track.artworkHue);
  const coverSize = Math.min(width - 64, 360);

  return (
    <Animated.View
      style={[styles.root, { transform: [{ translateY: slide }] }]}
      accessibilityViewIsModal
    >
      <LinearGradient
        colors={[`${gradient[0]}59`, `${gradient[1]}59`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={space.sm}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
          <View
            style={styles.iconButton}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Text style={styles.overflow}>⋯</Text>
          </View>
        </View>

        <View style={styles.middle}>
          <CoverArt hue={track.artworkHue} title={track.title} size={coverSize} radius={radius.cover} />
          <Text style={styles.title} numberOfLines={2}>
            {track.title}
          </Text>
          {track.artist ? (
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          ) : null}
        </View>

        <View>
          <ProgressBar
            positionMs={positionMs}
            durationMs={durationMs}
            onSeek={(ms) => {
              void seek(ms);
            }}
          />
          <View style={styles.transport}>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}
            >
              <Text style={styles.playGlyph}>{isPlaying ? '❚❚' : '▶'}</Text>
            </Pressable>
          </View>
          {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconPressed: {
    backgroundColor: '#ffffff14',
  },
  chevron: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
  },
  overflow: {
    color: colors.textDim,
    fontSize: 22,
    lineHeight: 26,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  title: {
    ...type.display,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: space.lg,
  },
  artist: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space.xs,
  },
  transport: {
    alignItems: 'center',
    marginTop: space.lg,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPressed: {
    opacity: 0.85,
  },
  playGlyph: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  error: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space.md,
  },
});
