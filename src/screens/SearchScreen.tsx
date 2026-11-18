import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import { searchTracks } from '../lib/search';
import { colors, space, type } from '../theme';
import { IconButton } from '../ui/IconButton';
import { ui } from '../ui/styles';
import type { Track } from '../types';

type Props = {
  visible: boolean;
  tracks: Track[];
  onSelect: (track: Track, queue: Track[]) => void;
  onBack: () => void;
};

const SLIDE_MS = 280;
const BOTTOM_PAD = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + 110;
const webInput =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;

export function SearchScreen({ visible, tracks, onSelect, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const { width } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));
  const [query, setQuery] = useState('');
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const listRef = useRef<FlatList<Track>>(null);
  const results = query.trim() ? searchTracks(tracks, query) : [];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [visible]);

  function close() {
    setQuery('');
    onBack();
  }

  function select(track: Track, queue: Track[]) {
    setQuery('');
    onSelect(track, queue);
  }

  return (
    <Animated.View
      style={[
        ui.overlay,
        {
          transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) },
          ],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton
          icon="chevron-back"
          label="Close search"
          onPress={close}
          size={26}
          color={colors.text}
        />
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textDim} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, artist, or album"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            underlineColorAndroid="transparent"
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            accessibilityLabel="Search title, artist, or album"
            style={[styles.input, webInput]}
          />
        </View>
      </View>

      {query.trim() ? (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={results}
            keyExtractor={(track) => track.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            {...scrollHandlers}
            renderItem={({ item }) => (
              <TrackRow track={item} onPress={(track) => select(track, results)} />
            )}
            ListEmptyComponent={<Text style={styles.hint}>No matches</Text>}
            contentContainerStyle={{ paddingBottom: BOTTOM_PAD + insets.bottom }}
          />
          <ScrollBar
            scrollY={scrollY}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            bottomOffset={TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8}
            onScrollTo={(offset) => listRef.current?.scrollToOffset({ offset, animated: false })}
          />
        </View>
      ) : (
        <Text style={styles.hint}>Search your library</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 44,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.text,
    paddingVertical: 0,
  },
  hint: {
    ...type.meta,
    color: colors.textDim,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
});
