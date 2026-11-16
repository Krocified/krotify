import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeTagName } from '../tags/name';
import { useTags } from '../tags/TagProvider';
import { colors, space, type } from '../theme';

export type TagEditorProps = {
  trackId: string;
  readOnly?: boolean;
};

const INVALID_NAME = 'Enter a tag name of 32 characters or less.';
const WRITE_FAILED = 'Could not update tags. Try again.';

export function TagEditor({ trackId, readOnly = false }: TagEditorProps) {
  const { tags, tagsFor, createAndAssign, unassign } = useTags();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const assigned = tagsFor(trackId);

  if (readOnly) {
    if (assigned.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Tags</Text>
        <View style={styles.chips}>
          {assigned.map((tag) => (
            <View key={tag.id} style={styles.chip} accessible accessibilityLabel={tag.name}>
              <Text style={styles.chipText} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  async function add() {
    if (busy) return;
    const name = normalizeTagName(draft);
    if (name === null) {
      setMessage(INVALID_NAME);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const tag = await createAndAssign(trackId, name);
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
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await unassign(trackId, tagId);
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const showHint = tags.length === 0 && assigned.length === 0;

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Tags</Text>
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
      ) : null}
      {showHint ? <Text style={styles.hint}>No tags yet. Add one below.</Text> : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  label: {
    ...type.meta,
    color: colors.textDim,
  },
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
    backgroundColor: colors.surface,
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
