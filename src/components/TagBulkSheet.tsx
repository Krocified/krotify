import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeTagName } from '../tags/name';
import { useTags } from '../tags/TagProvider';
import { tagCoverage } from '../tags/filter';
import { colors, radius, space, type } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  trackIds: readonly string[];
  onClose: () => void;
  onDone: (message: string) => void;
};

const INVALID_NAME = 'Enter a tag name of 32 characters or less.';
const WRITE_FAILED = 'Could not update tags. Try again.';

export function TagBulkSheet({ visible, trackIds, onClose, onDone }: Props) {
  const { tags, assignments, assignMany, unassignMany, createAndAssignMany } = useTags();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const busy = busyId !== null || adding;
  const count = trackIds.length;

  async function toggle(tagId: string, tagName: string, covered: boolean) {
    if (busy || count === 0) return;
    setBusyId(tagId);
    setMessage(null);
    try {
      if (covered) {
        await unassignMany(trackIds, tagId);
        onDone(`Removed "${tagName}" from ${count} ${count === 1 ? 'track' : 'tracks'}`);
      } else {
        await assignMany(trackIds, tagId);
        onDone(`Tagged ${count} ${count === 1 ? 'track' : 'tracks'} with "${tagName}"`);
      }
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    if (busy || count === 0) return;
    const name = normalizeTagName(draft);
    if (name === null) {
      setMessage(INVALID_NAME);
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      const tag = await createAndAssignMany(trackIds, name);
      if (!tag) {
        setMessage(INVALID_NAME);
        return;
      }
      setDraft('');
      onDone(`Tagged ${count} ${count === 1 ? 'track' : 'tracks'} with "${tag.name}"`);
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Sheet variant="dialog" visible={visible} title="Tags" onClose={onClose} footer={
        <>
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
            maxLength={32}
            accessibilityLabel="New tag"
            style={styles.input}
          />
          <Pressable
            onPress={() => void add()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Create tag and assign"
            accessibilityState={{ disabled: busy, busy: adding }}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            {adding ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name="add" size={22} color={colors.text} />
            )}
          </Pressable>
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
        </>
      }
    >
      <Text style={styles.hint}>
        Applies to {count} selected {count === 1 ? 'track' : 'tracks'}.
      </Text>
      {tags.length === 0 ? (
        <Text style={styles.empty}>No tags yet. Create one below.</Text>
      ) : (
        [...tags]
          .sort((left, right) =>
            left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
          )
          .map((tag) => {
            const state = tagCoverage(assignments, trackIds, tag.id);
            const icon =
              state === 'all' ? 'checkbox' : state === 'partial' ? 'remove-circle' : 'square-outline';
            return (
              <Pressable
                key={tag.id}
                onPress={() => void toggle(tag.id, tag.name, state === 'all')}
                disabled={busy}
                accessibilityRole="checkbox"
                accessibilityLabel={
                  state === 'all' ? `Remove tag ${tag.name}` : `Add tag ${tag.name}`
                }
                accessibilityState={{
                  checked: state === 'all' ? true : state === 'partial' ? 'mixed' : false,
                  disabled: busy,
                }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                {busyId === tag.id ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Ionicons
                    name={icon}
                    size={22}
                    color={state === 'none' ? colors.textDim : colors.accent}
                  />
                )}
                <Text style={styles.label} numberOfLines={1}>
                  {tag.name}
                </Text>
              </Pressable>
            );
          })
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...type.meta,
    color: colors.textDim,
    paddingBottom: space.sm,
  },
  empty: {
    ...type.meta,
    color: colors.textDim,
    paddingVertical: space.md,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.screen,
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  label: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.sm,
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
  addButton: {
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
    paddingTop: space.sm,
  },
  done: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
    borderRadius: radius.screen,
  },
  doneText: {
    ...type.body,
    color: colors.textDim,
    textAlign: 'center',
  },
});
