import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { MarqueeText } from '../components/MarqueeText';
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
import { normalizeTagName } from '../tags/name';
import { useTags } from '../tags/TagProvider';
import { createTag, deleteTag } from '../tags/repo';
import { colors, radius, space, type } from '../theme';
import { ui } from '../ui/styles';

type Props = {
  visible: boolean;
  onBack: () => void;
  registerBackInterceptor?: (handler: (() => boolean) | null) => void;
};

const INVALID_NAME = 'Enter a tag name of 32 characters or less.';
const DUPLICATE_NAME = 'That tag already exists.';
const WRITE_FAILED = 'Could not update tags. Try again.';

export function TagsScreen({ visible, onBack, registerBackInterceptor }: Props) {
  const insets = useSafeAreaInsets();
  const { tags, loaded, refresh } = useTags();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const sorted = [...tags].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
  const selectedCount = sorted.filter((tag) => selectedIds.has(tag.id)).length;
  const selectable = sorted.length > 0;

  if (!visible && (selecting || selectedIds.size > 0)) {
    setSelecting(false);
    setSelectedIds(clearSelection());
  }


  function exitSelection() {
    setSelecting(false);
    setSelectedIds(clearSelection());
  }

  function toggleSelection(id: string) {
    setSelectedIds((previous) => toggleId(previous, id));
  }

  useEffect(() => {
    if (!registerBackInterceptor) return;
    registerBackInterceptor(selectionBackHandler(selecting, exitSelection));
    return () => registerBackInterceptor(null);
  }, [registerBackInterceptor, selecting]);

  async function add() {
    if (busy) return;
    const name = normalizeTagName(draft);
    if (name === null) {
      setMessage(INVALID_NAME);
      return;
    }
    const duplicate = tags.some(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      setMessage(DUPLICATE_NAME);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const tag = await createTag(name);
      if (!tag) {
        setMessage(INVALID_NAME);
        return;
      }
      setDraft('');
      await refresh();
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteIds || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const id of pendingDeleteIds) await deleteTag(id);
      setPendingDeleteIds(null);
      exitSelection();
      await refresh();
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = pendingDeleteIds?.length ?? 0;

  return (
    <View
      style={[ui.overlay, !visible && ui.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={ui.title}>Tags</Text>
        {selecting ? (
          <View style={ui.iconButton} />
        ) : selectable ? (
          <Pressable
            onPress={() => setSelecting(true)}
            accessibilityRole="button"
            accessibilityLabel="Select tags"
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
          allState={selectionState(selectedIds, sorted.map((tag) => tag.id))}
          onToggleAll={() =>
            setSelectedIds((previous) =>
              toggleAllVisible(previous, sorted.map((tag) => tag.id)),
            )
          }
          actions={[
            {
              key: 'delete',
              label: 'Delete',
              icon: 'trash-outline',
              tone: 'destructive',
              disabled: selectedCount === 0,
              onPress: () => setPendingDeleteIds([...selectedIds]),
            },
          ]}
          onCancel={exitSelection}
        />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          ui.content,
          { paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + insets.bottom + space.xl },
        ]}
      >
        {selecting ? null : (
          <View>
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  setMessage(null);
                }}
                onSubmitEditing={() => void add()}
                placeholder="New tag"
                placeholderTextColor={colors.textDim}
                editable={!busy}
                returnKeyType="done"
                autoCapitalize="words"
                accessibilityLabel="New tag"
                style={styles.input}
              />
              <Pressable
                onPress={() => void add()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Add tag"
                accessibilityState={{ disabled: busy, busy }}
                style={({ pressed }) => [styles.add, pressed && ui.pressed]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Ionicons name="add" size={22} color={colors.text} />
                )}
              </Pressable>
            </View>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        )}

        <View style={ui.card}>
          {!loaded ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : sorted.length === 0 ? (
            <Text style={styles.empty}>No tags yet.</Text>
          ) : (
            sorted.map((tag) => {
              const selected = selectedIds.has(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => {
                    if (selecting) toggleSelection(tag.id);
                  }}
                  onLongPress={() => {
                    if (busy) return;
                    if (selecting) toggleSelection(tag.id);
                    else {
                      setSelecting(true);
                      setSelectedIds(new Set([tag.id]));
                    }
                  }}
                  accessibilityRole={selecting ? 'checkbox' : undefined}
                  accessibilityState={selecting ? { checked: selected } : undefined}
                  accessibilityLabel={
                    selecting ? `${tag.name}${selected ? ', selected' : ''}` : tag.name
                  }
                  style={({ pressed }) => [ui.row, styles.rowBorder, pressed && ui.rowPressed]}
                >
                  <View style={ui.rowText}>
                    <MarqueeText text={tag.name} style={ui.rowTitle} />
                    <Text style={ui.rowMeta}>
                      {tag.count} {tag.count === 1 ? 'track' : 'tracks'}
                    </Text>
                  </View>
                  {selecting ? (
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? colors.accent : colors.textDim}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setPendingDeleteIds([tag.id])}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${tag.name}`}
                      accessibilityState={{ disabled: busy }}
                      hitSlop={space.sm}
                      style={({ pressed }) => [styles.delete, pressed && ui.pressed]}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
        {!selecting && message && loaded && sorted.length > 0 ? (
          <Text style={styles.message}>{message}</Text>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={pendingDeleteIds !== null}
        title={pendingCount === 1 ? 'Delete tag?' : `Delete ${pendingCount} tags?`}
        message={
          pendingCount === 1
            ? `Delete this tag? It will be removed from every track.`
            : `Delete ${pendingCount} tags? They will be removed from every track.`
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteIds(null)}
      />
    </View>
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
  loading: {
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    padding: space.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  delete: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    marginHorizontal: -space.md,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    paddingHorizontal: space.sm + 4,
    minHeight: 40,
  },
  add: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  message: {
    ...type.meta,
    color: colors.danger,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
});
