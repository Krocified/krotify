import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration } from '../lib/format';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';
import { MarqueeText } from './MarqueeText';

type Props = {
  visible: boolean;
  upcoming: Track[];
  onSelect: (track: Track) => void;
  onClose: () => void;
};

const SLIDE_MS = 220;
const CLOSE_DRAG_PX = 80;

export function QueuePanel({ visible, upcoming, onSelect, onClose }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [translateY] = useState(() => new Animated.Value(height));
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : height,
      duration: SLIDE_MS,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [height, translateY, visible]);

  const panResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > CLOSE_DRAG_PX) {
            onCloseRef.current();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        },
      }),
    [translateY],
  );

  const countLabel = `${upcoming.length} ${upcoming.length === 1 ? 'song' : 'songs'}`;

  return (
    <View
      style={styles.layer}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      accessibilityViewIsModal={visible}
    >
      {visible ? (
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom, transform: [{ translateY }] }]}
        accessibilityViewIsModal={visible}
      >
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Up Next</Text>
              <Text style={styles.meta}>{countLabel}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close queue"
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-down" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <FlatList
          data={upcoming}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            upcoming.length === 0 && styles.listEmptyContent,
          ]}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing up next</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${item.title}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <CoverArt
                hue={item.artworkHue}
                title={item.title}
                size={48}
                radius={4}
                uri={item.artworkUri}
              />
              <View style={styles.rowText}>
                <MarqueeText text={item.title} style={styles.rowTitle} />
                {item.artist ? (
                  <Text style={styles.rowArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.duration}>{formatDuration(item.durationMs)}</Text>
            </Pressable>
          )}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.screen,
    borderTopRightRadius: radius.screen,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDim,
    opacity: 0.5,
  },
  headerRow: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: 2,
  },
  title: {
    ...type.body,
    fontSize: 20,
    color: colors.text,
  },
  meta: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  listContent: {
    paddingHorizontal: space.md,
    paddingBottom: space.xl,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowArtist: {
    ...type.meta,
    color: colors.textDim,
  },
  duration: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  pressed: {
    opacity: 0.7,
  },
});
