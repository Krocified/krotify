import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import type { LrcLine } from '../lib/lrc';
import { colors, radius, space, type } from '../theme';
import type { LyricsState } from '../library/useLyrics';

type Props = {
  state: LyricsState;
  lines: LrcLine[];
  plain?: string;
  positionMs: number;
  onSeek: (positionMs: number) => void;
  onImport?: () => void;
  importing?: boolean;
};

export function LyricsPanel({
  state,
  lines,
  plain,
  positionMs,
  onSeek,
  onImport,
  importing = false,
}: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offsets = useRef<number[]>([]);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].atMs <= positionMs) index = i;
      else break;
    }
    return index;
  }, [lines, positionMs]);

  useEffect(() => {
    if (activeIndex < 0 || viewportHeight <= 0) return;
    const offset = offsets.current[activeIndex];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, offset - viewportHeight / 3),
      animated: true,
    });
  }, [activeIndex, viewportHeight, layoutVersion]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  if (state === 'loading' || state === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.message}>Loading lyrics</Text>
      </View>
    );
  }

  if (state === 'none' || state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Lyrics not found</Text>
        {onImport ? (
          <Pressable
            onPress={onImport}
            disabled={importing}
            accessibilityRole="button"
            accessibilityLabel="Import .lrc"
            accessibilityState={{ disabled: importing }}
            style={({ pressed }) => [
              styles.importButton,
              pressed && !importing && styles.importButtonPressed,
              importing && styles.importButtonDisabled,
            ]}
          >
            {importing ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.importButtonText}>Import .lrc</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (plain) {
    return (
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.plainContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.plain}>{plain}</Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root} onLayout={handleLayout}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingVertical: viewportHeight / 2 }]}
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line, index) => {
          const active = index === activeIndex;
          return (
            <Pressable
              key={`${line.atMs}-${index}-${line.text}`}
              onLayout={(event) => {
                offsets.current[index] = event.nativeEvent.layout.y;
                if (index === activeIndex) setLayoutVersion((version) => version + 1);
              }}
              onPress={() => onSeek(line.atMs)}
              accessibilityRole="button"
              accessibilityLabel={`Seek to ${line.text}`}
              style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
            >
              <Text style={[styles.lineText, active && styles.lineTextActive]}>
                {line.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  message: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
  importButton: {
    minHeight: 44,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  importButtonPressed: {
    backgroundColor: '#ffffff14',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    ...type.meta,
    color: colors.text,
  },
  line: {
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: space.sm,
  },
  linePressed: {
    backgroundColor: '#ffffff10',
  },
  lineText: {
    ...type.body,
    fontSize: 18,
    color: colors.textDim,
    textAlign: 'center',
    opacity: 0.55,
  },
  lineTextActive: {
    color: colors.text,
    opacity: 1,
  },
  plainContent: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  plain: {
    ...type.body,
    color: colors.textDim,
    lineHeight: 26,
    textAlign: 'center',
  },
});
