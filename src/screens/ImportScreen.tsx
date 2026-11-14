import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { ScrollBar } from '../components/ScrollBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TrackRow } from '../components/TrackRow';
import { useScrollProgress } from '../components/useScrollProgress';
import { colors, radius, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  imports: Track[];
  importing: boolean;
  onImport: () => Promise<void>;
  onSelect: (track: Track, queue: Track[]) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

export const LINK_IMPORT_ENABLED = false;

export function ImportScreen({
  imports,
  importing,
  onImport,
  onSelect,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const { scrollY, contentHeight, viewportHeight, scrollHandlers } = useScrollProgress();
  const listRef = useRef<FlatList<Track>>(null);
  const [error, setError] = useState<string | null>(null);
  const canImport = Platform.OS !== 'web';
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 8;

  async function startImport() {
    if (!canImport || importing) return;
    setError(null);
    try {
      await onImport();
    } catch {
      setError('Could not import those files. Try again.');
    }
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        leading={<Ionicons name="download-outline" size={26} color={colors.text} />}
        title="Import"
        trailing={
          <HeaderActions onOpenSearch={onOpenSearch} onOpenSettings={onOpenSettings} />
        }
      />
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={imports}
          keyExtractor={(track) => track.id}
          showsVerticalScrollIndicator={false}
          {...scrollHandlers}
          contentContainerStyle={{
            paddingHorizontal: space.md,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 170,
          }}
          ListHeaderComponent={
            <View style={styles.header}>
              <Pressable
                onPress={() => void startImport()}
                disabled={!canImport || importing}
                accessibilityRole="button"
                accessibilityLabel="Import audio files"
                accessibilityState={{ disabled: !canImport || importing, busy: importing }}
                style={({ pressed }) => [
                  styles.card,
                  (!canImport || importing) && styles.cardDisabled,
                  pressed && canImport && !importing && styles.cardPressed,
                ]}
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Import audio files</Text>
                  <Text style={styles.cardMeta}>
                    {canImport
                      ? importing
                        ? 'Importing files…'
                        : 'Copy audio files into the app'
                      : 'Available on device builds'}
                  </Text>
                </View>
                {importing ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="add" size={24} color={colors.textDim} />
                )}
              </Pressable>

              {error ? (
                <View style={styles.error}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {!LINK_IMPORT_ENABLED ? (
                <>
                  <Text style={styles.sectionTitle}>From a link</Text>
                  <View style={[styles.card, styles.linkCard]}>
                    <Ionicons name="link-outline" size={24} color={colors.textDim} />
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>Link import is disabled</Text>
                      <Text style={styles.cardMeta}>
                        Only import audio you own or have the rights to download. Link import
                        needs a licensed resolver, and none is approved for Krotify.
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionTitle}>Recent imports</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No imports yet</Text>
              <Text style={styles.emptyMeta}>
                Pick audio files to copy them into Krotify. They stay on this device.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TrackRow track={item} onPress={(track) => onSelect(track, imports)} />
          )}
        />
        <ScrollBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
          bottomOffset={bottomOffset}
          onScrollTo={(offset) => listRef.current?.scrollToOffset({ offset, animated: false })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    gap: space.md,
    paddingTop: space.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surface,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardPressed: {
    backgroundColor: colors.surfaceHi,
  },
  linkCard: {
    alignItems: 'flex-start',
  },
  cardText: {
    flex: 1,
    gap: space.xs,
  },
  cardTitle: {
    ...type.body,
    color: colors.text,
  },
  cardMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  error: {
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: '#3A1518',
  },
  errorText: {
    ...type.meta,
    color: '#FF8A8A',
  },
  sectionTitle: {
    ...type.meta,
    color: colors.textDim,
    paddingTop: space.sm,
  },
  empty: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  emptyTitle: {
    ...type.body,
    color: colors.text,
  },
  emptyMeta: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
});
