import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LyricsState } from '../library/useLyrics';
import type { LrcLine } from '../lib/lrc';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';
import { LyricsPanel } from './LyricsPanel';
import { MarqueeText } from './MarqueeText';
import { Sheet } from './Sheet';

type Props = {
  track: Track;
  lyrics: { state: LyricsState; lines: LrcLine[]; plain?: string };
  positionMs: number;
  onSeek: (positionMs: number) => void;
  onImport?: () => void;
  onPaste?: () => void;
  onReload?: () => void;
  importing?: boolean;
};

type MenuAction = { key: string; label: string; onPress: () => void };

export function LyricsStage({
  track,
  lyrics,
  positionMs,
  onSeek,
  onImport,
  onPaste,
  onReload,
  importing = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const actions: MenuAction[] = [];
  if (onImport) actions.push({ key: 'import', label: 'Import .lrc', onPress: onImport });
  if (onPaste) actions.push({ key: 'paste', label: 'Paste lyrics', onPress: onPaste });
  if (onReload) actions.push({ key: 'reload', label: 'Reload lyrics', onPress: onReload });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <CoverArt
          hue={track.artworkHue}
          title={track.title}
          size={48}
          radius={4}
          uri={track.artworkUri}
        />
        <View style={styles.titles}>
          <MarqueeText text={track.title} style={styles.title} />
          {track.artist ? (
            <MarqueeText text={track.artist} style={styles.artist} />
          ) : null}
        </View>
        {importing ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Lyrics options"
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textDim} />
        </Pressable>
      </View>
      <View style={styles.panel}>
        <LyricsPanel
          state={lyrics.state}
          lines={lyrics.lines}
          plain={lyrics.plain}
          positionMs={positionMs}
          onSeek={onSeek}
          onImport={onImport}
          importing={importing}
        />
      </View>
      <Sheet visible={menuOpen} title="Lyrics" onClose={() => setMenuOpen(false)}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              setMenuOpen(false);
              action.onPress();
            }}
            disabled={action.key === 'import' && importing}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: action.key === 'import' && importing }}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <Text style={styles.menuLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.sm,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  artist: {
    ...type.meta,
    color: colors.textDim,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  panel: {
    flex: 1,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  menuRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.screen,
  },
  menuLabel: {
    ...type.body,
    color: colors.text,
  },
});
