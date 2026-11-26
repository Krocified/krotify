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
import Reanimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { BackPill } from '../components/ScreenHeader';
import { SelectionBar } from '../components/SelectionBar';
import {
  clearSelection,
  selectionBackHandler,
  selectionState,
  toggleAllVisible,
  toggleId,
} from '../lib/selection';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { ScrollBar } from '../components/ScrollBar';
import { useScrollProgress } from '../components/useScrollProgress';
import { isMissingTrack } from '../lib/settingsView';
import { colors, radius, space, type } from '../theme';
import { EmptyState } from '../ui/EmptyState';
import { ui } from '../ui/styles';
import type { Track } from '../types';

type Props = {
  visible: boolean;
  tracks: Track[];
  onBack: () => void;
  onRestore: (id: string) => void;
  onRestoreMany: (ids: string[]) => void;
  onRestoreAll: () => void;
  onClear: (track: Track) => void;
  onDelete: (track: Track) => void;
  onClearMany: (tracks: Track[]) => void;
  onDeleteMany: (tracks: Track[]) => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
};

const SLIDE_MS = 280;

export function HiddenTracksScreen({
  visible,
  tracks,
  onBack,
  onRestore,
  onRestoreMany,
  onRestoreAll,
  onClear,
  onDelete,
  onClearMany,
  onDeleteMany,
  registerBackInterceptor,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { width } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedTracks = tracks.filter((track) => selectedIds.has(track.id));
  const selectedCount = selectedTracks.length;

  if (!visible && (selecting || selectedIds.size > 0)) {
    setSelecting(false);
    setSelectedIds(clearSelection());
  }


  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, visible]);

  function startSelection(track: Track) {
    setSelecting(true);
    setSelectedIds(new Set([track.id]));
  }

  function toggleSelection(track: Track) {
    setSelectedIds((previous) => toggleId(previous, track.id));
  }

  function exitSelection() {
    setSelecting(false);
    setSelectedIds(clearSelection());
  }

  useEffect(() => {
    if (!registerBackInterceptor) return;
    registerBackInterceptor(selectionBackHandler(selecting, exitSelection));
    return () => registerBackInterceptor(null);
  }, [registerBackInterceptor, selecting]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        ui.overlay,
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
      <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={ui.title}>Hidden tracks</Text>
        {selecting ? (
          <View style={ui.iconButton} />
        ) : tracks.length > 0 ? (
          <Pressable
            onPress={() => setSelecting(true)}
            accessibilityRole="button"
            accessibilityLabel="Select hidden tracks"
            hitSlop={space.sm}
            style={({ pressed }) => [styles.headerAction, pressed && ui.pressed]}
          >
            <Text style={styles.headerActionText}>Select</Text>
          </Pressable>
        ) : (
          <View style={ui.iconButton} />
        )}
      </View>

      {selecting ? (
        <SelectionBar
          count={selectedCount}
          allState={selectionState(selectedIds, tracks.map((track) => track.id))}
          onToggleAll={() =>
            setSelectedIds((previous) =>
              toggleAllVisible(previous, tracks.map((track) => track.id)),
            )
          }
          actions={[
            {
              key: 'restore',
              label: 'Restore',
              icon: 'refresh',
              disabled: selectedCount === 0,
              onPress: () => {
                const ids = selectedTracks.map((track) => track.id);
                exitSelection();
                onRestoreMany(ids);
              },
            },
            {
              key: 'clear',
              label: 'Clear',
              icon: 'remove-circle-outline',
              disabled: selectedCount === 0,
              onPress: () => {
                const targets = selectedTracks;
                exitSelection();
                onClearMany(targets);
              },
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: 'trash-outline',
              tone: 'destructive',
              disabled: selectedCount === 0,
              onPress: () => {
                const targets = selectedTracks;
                exitSelection();
                onDeleteMany(targets);
              },
            },
          ]}
          onCancel={exitSelection}
        />
      ) : null}

      <View style={{ flex: 1 }}>
        <Reanimated.FlatList
          data={tracks}
          keyExtractor={(track) => track.id}
          extraData={selectedIds}
          showsVerticalScrollIndicator={false}
          {...scrollHandlers}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + space.xl + 110,
            },
          ]}
          ListHeaderComponent={
            tracks.length === 0 || selecting ? undefined : (
              <View style={ui.card}>
                <Pressable
                  onPress={onRestoreAll}
                  accessibilityRole="button"
                  accessibilityLabel="Restore all hidden tracks"
                  style={({ pressed }) => [ui.row, pressed && ui.rowPressed]}
                >
                  <View style={ui.rowText}>
                    <Text style={ui.rowTitle}>Restore all</Text>
                    <Text style={ui.rowMeta}>
                      {tracks.length} hidden {tracks.length === 1 ? 'track' : 'tracks'}
                    </Text>
                  </View>
                  <Ionicons name="refresh" size={22} color={colors.accent2} />
                </Pressable>
              </View>
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon="eye-off-outline"
              text="No hidden tracks. Tracks you hide from the library appear here."
            />
          }
          renderItem={({ item: track }) => {
            const missing = isMissingTrack(track);
            return (
              <View style={styles.track}>
                <Pressable
                  onPress={() => {
                    if (selecting) toggleSelection(track);
                  }}
                  onLongPress={() => {
                    if (selecting) toggleSelection(track);
                    else startSelection(track);
                  }}
                  accessibilityRole={selecting ? 'checkbox' : undefined}
                  accessibilityLabel={
                    selecting
                      ? `${track.title}${selectedIds.has(track.id) ? ', selected' : ''}`
                      : undefined
                  }
                  accessibilityState={selecting ? { checked: selectedIds.has(track.id) } : undefined}
                  style={styles.trackMain}
                >
                  <CoverArt
                    hue={track.artworkHue}
                    title={track.title}
                    size={56}
                    radius={4}
                    uri={track.artworkUri}
                  />
                  <View style={styles.trackText}>
                    <Text style={ui.rowTitle} numberOfLines={1}>
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
                      <Text style={ui.rowMeta} numberOfLines={1}>
                        {track.artist}
                      </Text>
                    ) : null}
                  </View>
                  {selecting ? (
                    <Ionicons
                      name={
                        selectedIds.has(track.id) ? 'checkmark-circle' : 'ellipse-outline'
                      }
                      size={24}
                      color={selectedIds.has(track.id) ? colors.accent : colors.textDim}
                    />
                  ) : null}
                </Pressable>
                {selecting ? null : (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => onRestore(track.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Restore ${track.title}`}
                      style={({ pressed }) => [styles.action, pressed && ui.pressed]}
                    >
                      <Text style={styles.actionRestore}>Restore</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onClear(track)}
                      accessibilityRole="button"
                      accessibilityLabel={`Clear ${track.title} from the library`}
                      style={({ pressed }) => [styles.action, pressed && ui.pressed]}
                    >
                      <Text style={styles.actionText}>Clear</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDelete(track)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${track.title} and its file`}
                      style={({ pressed }) => [styles.action, pressed && ui.pressed]}
                    >
                      <Text style={styles.actionDanger}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
        <ScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bottomOffset={TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: 999,
  },
  headerActionText: {
    ...type.meta,
    color: colors.textDim,
  },
  listContent: {
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  track: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
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
