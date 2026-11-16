import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderActions, ScreenHeader } from '../components/ScreenHeader';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import type { ImportFailure } from '../imports/local';
import { colors, radius, space, type } from '../theme';

type Props = {
  importing: boolean;
  importFailures: ImportFailure[];
  onImport: () => Promise<void>;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

export function ImportScreen({
  importing,
  importFailures,
  onImport,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const canImport = Platform.OS !== 'web';
  const showIdle = !importing && importFailures.length === 0;

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP + 32,
        }}
      >
        <View style={styles.content}>
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

          {importFailures.length > 0 ? (
            <View style={styles.failure}>
              <Text style={styles.failureText}>
                {importFailures.length} file{importFailures.length === 1 ? '' : 's'} could
                not be imported
              </Text>
              <Text style={styles.failureMeta}>{importFailures[0].reason}</Text>
            </View>
          ) : null}

          {showIdle ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing imported yet</Text>
              <Text style={styles.emptyMeta}>
                Pick audio files or paste a link. Imports appear in the Library tab.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
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
  failure: {
    padding: space.md,
    borderRadius: radius.screen,
    backgroundColor: '#3A2E15',
    gap: space.xs,
  },
  failureText: {
    ...type.meta,
    color: '#FFD08A',
  },
  failureMeta: {
    ...type.meta,
    color: colors.textDim,
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
