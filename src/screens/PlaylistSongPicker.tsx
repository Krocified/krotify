import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackPill } from '../components/ScreenHeader';
import { SelectionBar } from '../components/SelectionBar';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../components/TabBar';
import { TagFilterBar } from '../components/TagFilterBar';
import { TrackRow } from '../components/TrackRow';
import { addableSelectedIds, pickerSelectableIds, pickerTracks } from '../lib/playlistPicker';
import {
  clearSelection,
  selectionState,
  toggleAllVisible,
  toggleId,
} from '../lib/selection';
import type { TagCount } from '../tags/filter';
import { colors, space, type } from '../theme';
import type { Track } from '../types';

type Props = {
  playlistName: string;
  tracks: Track[];
  existingIds: readonly string[];
  tags: TagCount[];
  assignments: ReadonlyMap<string, readonly string[]>;
  onClose: () => void;
  onAdd: (trackIds: string[]) => Promise<void>;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
};

export function PlaylistSongPicker({
  playlistName,
  tracks,
  existingIds,
  tags,
  assignments,
  onClose,
  onAdd,
  registerBackInterceptor,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const existing = useMemo(() => new Set(existingIds), [existingIds]);
  const visible = useMemo(
    () => pickerTracks({ tracks, query, tagId, assignments }),
    [tracks, query, tagId, assignments],
  );
  const selectableIds = useMemo(
    () => pickerSelectableIds(visible, existingIds),
    [visible, existingIds],
  );
  const ordered = useMemo(
    () => addableSelectedIds(visible, selectedIds),
    [visible, selectedIds],
  );
  const selectedCount = ordered.length;

  useEffect(() => {
    if (!registerBackInterceptor) return;
    registerBackInterceptor(() => {
      if (selectedIds.size > 0) {
        setSelectedIds(clearSelection());
        return true;
      }
      if (query !== '') {
        setQuery('');
        return true;
      }
      onClose();
      return true;
    });
    return () => registerBackInterceptor(null);
  }, [registerBackInterceptor, selectedIds, query, onClose]);

  async function add() {
    if (busy || selectedCount === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      await onAdd(ordered);
    } catch {
      setMessage('Could not add these songs.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setSelectedIds(clearSelection());
    onClose();
  }

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + space.sm }]}
      accessibilityViewIsModal
    >
      <View style={styles.header}>
        <BackPill onPress={close} label="Back to playlist" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Add songs</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {playlistName}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search songs"
          placeholderTextColor={colors.textDim}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search songs to add"
          style={styles.searchInput}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={space.sm}
          >
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>

      <TagFilterBar tags={tags} selectedId={tagId} onSelect={setTagId} />

      <SelectionBar
        count={selectedCount}
        allState={selectionState(selectedIds, selectableIds)}
        onToggleAll={() => setSelectedIds((previous) => toggleAllVisible(previous, selectableIds))}
        actions={[
          {
            key: 'add',
            label: `Add ${selectedCount} ${selectedCount === 1 ? 'song' : 'songs'}`,
            icon: 'add',
            disabled: selectedCount === 0 || busy,
            onPress: () => void add(),
          },
        ]}
        onCancel={close}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={(track) => track.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + space.xl,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? 'No songs match that search.' : 'No songs with this tag.'}
          </Text>
        }
        renderItem={({ item }) => {
          const added = existing.has(item.id);
          return (
            <TrackRow
              track={item}
              selectionMode
              selected={selectedIds.has(item.id)}
              disabled={added}
              onPress={(track) => {
                if (added) return;
                setSelectedIds((previous) => toggleId(previous, track.id));
              }}
            />
          );
        }}
      />
    </View>
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
    gap: space.md,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  subtitle: {
    ...type.meta,
    color: colors.textDim,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    color: colors.text,
  },
  message: {
    ...type.meta,
    color: colors.danger,
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: space.xl,
  },
});
