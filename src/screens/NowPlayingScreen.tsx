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
import { LyricsPanel } from '../components/LyricsPanel';
import { ProgressBar } from '../components/ProgressBar';
import { BackPill } from '../components/ScreenHeader';
import { SleepTimerControls, formatSleepRemaining } from '../components/SleepTimerControls';
import { coverColors } from '../lib/cover';
import { LYRICS_ENABLED } from '../lib/features';
import { isMissingTrack } from '../lib/settingsView';
import type { SleepPreset } from '../lib/sleepTimer';
import { useFavorites } from '../library/FavoritesProvider';
import { useLyrics } from '../library/useLyrics';
import { usePlayer } from '../player/PlayerProvider';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  onClose: () => void;
  onClearTrack?: (track: Track) => void;
  onDeleteFile?: (track: Track) => void;
  registerClose?: (close: (() => void) | null) => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
};

const SLIDE_MS = 300;
const CROSSFADE_MS = 200;
const LYRICS_COVER_SIZE = 180;

export function NowPlayingScreen({
  onClose,
  onClearTrack,
  onDeleteFile,
  registerClose,
  registerBackInterceptor,
}: Props) {
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
    shuffle,
    toggleShuffle,
    sleep,
    setSleep,
    toggle,
    seek,
    next,
    previous,
    advanceToNextPlayable,
  } = usePlayer();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavorites();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(height));
  const [resetToken, setResetToken] = useState(0);
  const [lyricsMode, setLyricsMode] = useState(false);
  const [lyricsNote, setLyricsNote] = useState<string | null>(null);
  const [likeNote, setLikeNote] = useState<{ trackId: string; message: string } | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [modeAnim] = useState(() => new Animated.Value(0));
  const lyrics = useLyrics(track, LYRICS_ENABLED && lyricsMode);

  useEffect(() => {
    if (!LYRICS_ENABLED) return;
    if (!lyricsMode || (lyrics.state !== 'none' && lyrics.state !== 'error')) return;
    const timer = setTimeout(() => {
      setLyricsNote(lyrics.state === 'error' ? "Couldn't load lyrics" : 'Lyrics not found');
      setLyricsMode(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [lyricsMode, lyrics.state]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [slide]);

  useEffect(() => {
    if (!LYRICS_ENABLED) return;
    Animated.timing(modeAnim, {
      toValue: lyricsMode ? 1 : 0,
      duration: CROSSFADE_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [lyricsMode, modeAnim]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    registerClose?.(close);
    return () => registerClose?.(null);
  }, [close, registerClose]);

  useEffect(() => {
    if (!registerBackInterceptor) return;
    if (!sleepOpen) {
      registerBackInterceptor(null);
      return;
    }
    registerBackInterceptor(() => {
      setSleepOpen(false);
      return true;
    });
    return () => registerBackInterceptor(null);
  }, [registerBackInterceptor, sleepOpen]);

  const selectSleepPreset = useCallback(
    (preset: SleepPreset) => {
      if (preset === 'end') setSleep('end');
      else setSleep('timer', preset);
      setSleepOpen(false);
    },
    [setSleep],
  );

  const cancelSleep = useCallback(() => {
    setSleep('off');
    setSleepOpen(false);
  }, [setSleep]);

  if (!track) return null;

  const liked = favoriteIds.has(track.id);
  const missing = isMissingTrack(track);
  const gradient = coverColors(track.artworkHue);
  const coverSize = Math.min(width - 64, 360);
  const artOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const sleepLabel = sleep.mode === 'off' ? 'Sleep timer' : `Sleep timer, ${formatSleepRemaining(sleep.mode, sleep.remainingMs)}`;

  const toggleLike = () => {
    setLikeNote(null);
    toggleFavorite(track.id).catch(() => {
      setLikeNote({ trackId: track.id, message: 'Could not update Liked Songs' });
    });
  };

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
          <BackPill onPress={close} icon="chevron-down" label="Close" plain />
          <View style={styles.topActions}>
            <Pressable
              onPress={() => setSleepOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={sleepLabel}
              accessibilityState={{ selected: sleep.mode !== 'off' }}
              style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}
            >
              <Ionicons
                name={sleep.mode === 'off' ? 'moon-outline' : 'moon'}
                size={22}
                color={sleep.mode === 'off' ? colors.textDim : colors.accent}
              />
              {sleep.mode !== 'off' ? (
                <Text style={styles.sleepBadge}>
                  {formatSleepRemaining(sleep.mode, sleep.remainingMs)}
                </Text>
              ) : null}
            </Pressable>
            <Pressable
              onPress={toggleLike}
              accessibilityRole="button"
              accessibilityLabel={
                liked
                  ? `Remove ${track.title} from Liked Songs`
                  : `Add ${track.title} to Liked Songs`
              }
              accessibilityState={{ selected: liked }}
              style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? colors.accent : colors.textDim}
              />
            </Pressable>
            {LYRICS_ENABLED ? (
              <Pressable
                onPress={() => {
                  setLyricsNote(null);
                  setLyricsMode((active) => !active);
                }}
                accessibilityRole="button"
                accessibilityLabel="Lyrics"
                accessibilityState={{ selected: lyricsMode }}
                style={({ pressed }) => [styles.topButton, pressed && styles.topButtonPressed]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={lyricsMode ? colors.accent : colors.textDim}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {sleepOpen ? (
          <View style={styles.sleepPanel}>
            <SleepTimerControls
              mode={sleep.mode}
              remainingMs={sleep.remainingMs}
              onSelect={selectSleepPreset}
              onCancel={cancelSleep}
            />
          </View>
        ) : null}

        <View style={styles.stage}>
          <Animated.View
            style={[styles.stageLayer, styles.artStage, { opacity: artOpacity }]}
            pointerEvents={lyricsMode ? 'none' : 'auto'}
            accessibilityElementsHidden={lyricsMode}
            importantForAccessibility={lyricsMode ? 'no-hide-descendants' : 'auto'}
          >
            <CoverArt
              hue={track.artworkHue}
              title={track.title}
              size={coverSize}
              radius={radius.cover}
              uri={track.artworkUri}
            />
            <Text style={styles.title} numberOfLines={2}>
              {track.title}
            </Text>
            {track.artist ? (
              <Text style={styles.artist} numberOfLines={1}>
                {track.artist}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View
            style={[styles.stageLayer, styles.lyricsStage, { opacity: modeAnim }]}
            pointerEvents={lyricsMode ? 'auto' : 'none'}
            accessibilityElementsHidden={!lyricsMode}
            importantForAccessibility={lyricsMode ? 'auto' : 'no-hide-descendants'}
          >
            <View style={styles.lyricsHeader}>
              <CoverArt
                hue={track.artworkHue}
                title={track.title}
                size={LYRICS_COVER_SIZE}
                radius={radius.cover}
                uri={track.artworkUri}
              />
              <View style={styles.lyricsTitles}>
                <Text style={styles.lyricsTitle} numberOfLines={2}>
                  {track.title}
                </Text>
                {track.artist ? (
                  <Text style={styles.artist} numberOfLines={2}>
                    {track.artist}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.lyricsPanel}>
              <LyricsPanel
                state={lyrics.state}
                lines={lyrics.lines}
                plain={lyrics.plain}
                positionMs={positionMs}
                onSeek={(ms) => {
                  void seek(ms);
                }}
              />
            </View>
          </Animated.View>
        </View>

        <View>
          {missing ? (
            <View style={styles.missingCard}>
              <View style={styles.missingHeader}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                <Text style={styles.missingTitle}>File missing</Text>
              </View>
              <Text style={styles.missingHint}>
                This track&apos;s audio file is missing or moved.
              </Text>
              <View style={styles.missingActions}>
                <Pressable
                  onPress={() => onClearTrack?.(track)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete from library"
                  style={({ pressed }) => [styles.missingButton, pressed && styles.sidePressed]}
                >
                  <Text style={styles.missingButtonText}>Delete from library</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteFile?.(track)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete file"
                  style={({ pressed }) => [
                    styles.missingButton,
                    styles.missingButtonDanger,
                    pressed && styles.sidePressed,
                  ]}
                >
                  <Text style={[styles.missingButtonText, styles.missingButtonDangerText]}>
                    Delete file
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  void advanceToNextPlayable();
                }}
                accessibilityRole="button"
                accessibilityLabel="Play next available"
                style={({ pressed }) => [styles.nextPlayable, pressed && styles.sidePressed]}
              >
                <Ionicons name="play-forward" size={16} color={colors.accent2} />
                <Text style={styles.nextPlayableText}>Play next available</Text>
              </Pressable>
            </View>
          ) : null}
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
            <View style={styles.shuffleSlot}>
              <Pressable
                onPress={toggleShuffle}
                accessibilityRole="button"
                accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
                accessibilityState={{ selected: shuffle }}
                style={({ pressed }) => [styles.sideButton, pressed && styles.sidePressed]}
              >
                <Ionicons
                  name="shuffle"
                  size={24}
                  color={shuffle ? colors.accent : colors.textDim}
                />
              </Pressable>
            </View>
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
                  {repeat === 'one' ? <Text style={styles.repeatOne}>1</Text> : null}
                </View>
              </Pressable>
            </View>
          </View>
          {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
          {LYRICS_ENABLED && lyricsNote ? <Text style={styles.error}>{lyricsNote}</Text> : null}
          {likeNote && likeNote.trackId === track.id ? (
            <Text style={styles.error}>{likeNote.message}</Text>
          ) : null}
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
    paddingHorizontal: space.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  topButton: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: 22,
  },
  topButtonPressed: {
    backgroundColor: '#ffffff14',
  },
  sleepBadge: {
    ...type.meta,
    fontSize: 12,
    color: colors.accent,
  },
  sleepPanel: {
    marginTop: space.sm,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
  stage: {
    flex: 1,
  },
  stageLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  artStage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  lyricsStage: {
    paddingTop: space.sm,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  lyricsTitles: {
    flex: 1,
    gap: space.xs,
  },
  lyricsTitle: {
    ...type.body,
    fontSize: 20,
    color: colors.text,
  },
  lyricsPanel: {
    flex: 1,
    marginTop: space.md,
    marginBottom: space.sm,
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
    marginTop: space.xs,
  },
  transport: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  missingCard: {
    gap: space.xs,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
  missingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  missingTitle: {
    ...type.body,
    color: colors.danger,
  },
  missingHint: {
    ...type.meta,
    color: colors.textDim,
  },
  missingActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  missingButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  missingButtonDanger: {
    backgroundColor: '#3A1418',
  },
  missingButtonText: {
    ...type.meta,
    color: colors.text,
  },
  missingButtonDangerText: {
    color: colors.danger,
  },
  nextPlayable: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xs,
  },
  nextPlayableText: {
    ...type.meta,
    color: colors.accent2,
  },
  centerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  shuffleSlot: {
    position: 'absolute',
    left: space.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
