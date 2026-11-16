import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeTagName } from '../tags/name';
import { useTags } from '../tags/TagProvider';
import { colors, space, type } from '../theme';
import type { Track } from '../types';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
};

const INVALID_NAME = 'Enter a tag name of 32 characters or less.';
const WRITE_FAILED = 'Could not update tags. Try again.';

export function TagAssignSheet({ visible, track, onClose }: Props) {
  const { tags, tagsFor, createAndAssign, unassign } = useTags();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const assigned = track ? tagsFor(track.id) : [];

  function close() {
    setDraft('');
    setMessage(null);
    setBusy(false);
    onClose();
  }

  async function add() {
    if (!track || busy) return;
    const name = normalizeTagName(draft);
    if (name === null) {
      setMessage(INVALID_NAME);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const tag = await createAndAssign(track.id, name);
      if (!tag) {
        setMessage(INVALID_NAME);
        return;
      }
      setDraft('');
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function remove(tagId: string) {
    if (!track || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await unassign(track.id, tagId);
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible && track !== null} title="Tags" onClose={close}>
      {assigned.length > 0 ? (
        <View style={styles.chips}>
          {assigned.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => void remove(tag.id)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag.name}`}
              accessibilityState={{ disabled: busy, busy }}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {tag.name}
              </Text>
              <Ionicons name="close" size={14} color={colors.textDim} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          {tags.length === 0 ? 'No tags yet. Add one below.' : 'No tags on this track.'}
        </Text>
      )}
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setMessage(null);
          }}
          onSubmitEditing={() => void add()}
          placeholder="Add a tag"
          placeholderTextColor={colors.textDim}
          editable={!busy}
          returnKeyType="done"
          autoCapitalize="words"
          accessibilityLabel="Add a tag"
          style={styles.input}
        />
        <Pressable
          onPress={() => void add()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add"
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceHi,
  },
  chipText: {
    ...type.meta,
    color: colors.text,
  },
  hint: {
    ...type.meta,
    color: colors.textDim,
  },
  inputRow: {
    flexDirection: 'row',
    gap: space.sm,
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
  },
  pressed: {
    opacity: 0.75,
  },
});
