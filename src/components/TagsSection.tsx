import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TagCount } from '../tags/filter';
import { normalizeTagName } from '../tags/name';
import { useTags } from '../tags/TagProvider';
import { createTag, deleteTag } from '../tags/repo';
import { colors, radius, space, type } from '../theme';
import { ConfirmSheet } from './ConfirmSheet';

type Props = {
  onTagsChanged?: () => void;
};

const INVALID_NAME = 'Enter a tag name of 32 characters or less.';
const DUPLICATE_NAME = 'That tag already exists.';
const WRITE_FAILED = 'Could not update tags. Try again.';

export function TagsSection({ onTagsChanged }: Props) {
  const { tags, loaded, refresh } = useTags();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TagCount | null>(null);
  const sorted = [...tags].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );

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
    if (!pendingDelete || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteTag(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
      onTagsChanged?.();
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.card}>
        {!loaded ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : sorted.length === 0 ? (
          <Text style={styles.empty}>No tags yet.</Text>
        ) : (
          sorted.map((tag) => (
            <View key={tag.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {tag.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {tag.count} {tag.count === 1 ? 'track' : 'tracks'}
                </Text>
              </View>
              <Pressable
                onPress={() => setPendingDelete(tag)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${tag.name}`}
                accessibilityState={{ disabled: busy }}
                hitSlop={space.sm}
                style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
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
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.addText}>Add</Text>
            )}
          </Pressable>
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <ConfirmSheet
        visible={pendingDelete !== null}
        title="Delete tag?"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? It will be removed from every track.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
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
    padding: space.md,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: 999,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  add: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  addText: {
    ...type.meta,
    color: colors.text,
  },
  message: {
    ...type.meta,
    color: colors.danger,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  pressed: {
    opacity: 0.75,
  },
});
