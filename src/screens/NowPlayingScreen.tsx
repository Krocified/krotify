import { Ionicons } from '@react-native-vector-icons/ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
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
  registerClose?: (close: (() => void) | null) => void;
};

const SLIDE_MS = 300;

export function NowPlayingScreen({ onClose, registerClose }: Props) {
  const {
    track,
    isPlaying,
    positionMs,
    durationMs,
    lastError,
    hasNext,
    hasPrevious,
    repeat,
    cycleRepeat,
    toggle,
    seek,
    next,
    previous,
  } = usePlayer();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(height));
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [slide]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    registerClose?.(close);
    return () => registerClose?.(null);
  }, [close, registerClose]);

  if (!track) return null;

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
            <Ionicons name="chevron-down" size={28} color={colors.text} />
          </Pressable>
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
            trackId={track.id}
            onSeek={(ms) => {
              void seek(ms);
            }}
            resetToken={resetToken}
          />
          <View style={styles.transport}>
            <View style={styles.centerGroup}>
            <Pressable
              onPress={() => {
                setResetToken((token) => token + 1);
                previous();
              }}
              disabled={!hasPrevious}
              accessibilityRole="button"
              accessibilityLabel="Previous track"
              accessibilityState={{ disabled: !hasPrevious }}
              style={({ pressed }) => [
                styles.sideButton,
                !hasPrevious && styles.disabled,
                pressed && hasPrevious && styles.sidePressed,
              ]}
            >
              <Ionicons name="play-skip-back" size={24} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={({ pressed }) => [styles.playButton, pressed && styles.playPressed]}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => {
                setResetToken((token) => token + 1);
                next();
              }}
              disabled={!hasNext}
              accessibilityRole="button"
              accessibilityLabel="Next track"
              accessibilityState={{ disabled: !hasNext }}
              style={({ pressed }) => [
                styles.sideButton,
                !hasNext && styles.disabled,
                pressed && hasNext && styles.sidePressed,
              ]}
            >
              <Ionicons name="play-skip-forward" size={24} color={colors.text} />
            </Pressable>
            </View>
            <View style={styles.repeatSlot}>
            <Pressable
              onPress={cycleRepeat}
              accessibilityRole="button"
              accessibilityLabel={`Repeat ${repeat}`}
              accessibilityState={{ selected: repeat !== 'off' }}
              style={({ pressed }) => [styles.sideButton, pressed && styles.sidePressed]}
            >
              <View style={styles.repeatIcon}>
                <Ionicons
                  name="repeat"
                  size={24}
                  color={repeat === 'off' ? colors.textDim : colors.accent}
                />
                {repeat === 'one' ? (
                  <Text style={styles.repeatOne}>1</Text>
                ) : null}
              </View>
            </Pressable>
            </View>
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
    justifyContent: 'center',
    marginTop: space.lg,
  },
  centerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  repeatSlot: {
    position: 'absolute',
    right: space.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  sideButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  sidePressed: {
    backgroundColor: '#ffffff14',
  },
  repeatIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOne: {
    position: 'absolute',
    top: -2,
    right: -2,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.35,
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
  error: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: space.md,
  },
});
