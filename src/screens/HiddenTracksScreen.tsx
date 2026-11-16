import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
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
import { BackPill } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { useScrollProgress } from '../components/useScrollProgress';
import { isMissingTrack } from '../lib/settingsView';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  visible: boolean;
  tracks: Track[];
  onBack: () => void;
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
  onClear: (track: Track) => void;
  onDelete: (track: Track) => void;
};

const SLIDE_MS = 280;

export function HiddenTracksScreen({
  visible,
  tracks,
  onBack,
  onRestore,
  onRestoreAll,
  onClear,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { width } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, visible]);

  return (
    <Animated.View
      style={[
        styles.root,
        {
          transform: [
            {
              translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }),
            },
          ],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={styles.title}>Hidden tracks</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          {...scrollHandlers}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        >
          {tracks.length === 0 ? (
            <Text style={styles.empty}>
              No hidden tracks. Tracks you hide from the library appear here.
            </Text>
          ) : (
            <>
              <View style={styles.card}>
                <Pressable
                  onPress={onRestoreAll}
                  accessibilityRole="button"
                  accessibilityLabel="Restore all hidden tracks"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>Restore all</Text>
                    <Text style={styles.rowMeta}>
                      {tracks.length} hidden {tracks.length === 1 ? 'track' : 'tracks'}
                    </Text>
                  </View>
                  <Ionicons name="refresh" size={22} color={colors.accent2} />
                </Pressable>
              </View>

              <View style={styles.card}>
                {tracks.map((track) => {
                  const missing = isMissingTrack(track);
                  return (
                    <View key={track.id} style={styles.track}>
                      <View style={styles.trackMain}>
                        <CoverArt
                          hue={track.artworkHue}
                          title={track.title}
                          size={56}
                          radius={4}
                          uri={track.artworkUri}
                        />
                        <View style={styles.trackText}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {track.title}
                          </Text>
                          {missing ? (
                            <View style={styles.missing}>
                              <Ionicons
                                name="alert-circle-outline"
                                size={14}
                                color={colors.danger}
                              />
                              <Text style={styles.missingText} numberOfLines={1}>
                                File missing
                              </Text>
                            </View>
                          ) : track.artist ? (
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {track.artist}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => onRestore(track.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Restore ${track.title}`}
                          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                        >
                          <Text style={styles.actionRestore}>Restore</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onClear(track)}
                          accessibilityRole="button"
                          accessibilityLabel={`Clear ${track.title} from the library`}
                          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                        >
                          <Text style={styles.actionText}>Clear</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onDelete(track)}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${track.title} and its file`}
                          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                        >
                          <Text style={styles.actionDanger}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Animated.ScrollView>
        <ScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bottomOffset={insets.bottom + space.md}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  content: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    lineHeight: 20,
    paddingTop: space.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceHi,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  track: {
    gap: space.sm,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  trackMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  trackText: {
    flex: 1,
    gap: 2,
  },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  missingText: {
    ...type.meta,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  action: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...type.meta,
    color: colors.text,
  },
  actionRestore: {
    ...type.meta,
    color: colors.accent2,
  },
  actionDanger: {
    ...type.meta,
    color: colors.danger,
  },
});
