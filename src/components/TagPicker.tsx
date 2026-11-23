import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeTagName } from '../tags/name';
import { useTags } from '../tags/TagProvider';
import { colors, space, type } from '../theme';

type Props = {
  trackId: string;
};

const INVALID_NAME = 'Enter a tag name of 32 characters or less.';
const WRITE_FAILED = 'Could not update tags. Try again.';

export function TagPicker({ trackId }: Props) {
  const { tags, tagsFor, assign, unassign, createAndAssign } = useTags();
  const [draft, setDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const assignedIds = new Set(tagsFor(trackId).map((tag) => tag.id));
  const sorted = [...tags].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
  const busy = busyId !== null || adding;

  async function toggle(tagId: string) {
    if (busy) return;
    setBusyId(tagId);
    setMessage(null);
    try {
      if (assignedIds.has(tagId)) await unassign(trackId, tagId);
      else await assign(trackId, tagId);
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    if (busy) return;
    const name = normalizeTagName(draft);
    if (name === null) {
      setMessage(INVALID_NAME);
      return;
    }
    const existing = tags.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );
    setAdding(true);
    setMessage(null);
    try {
      if (existing) {
        if (!assignedIds.has(existing.id)) await assign(trackId, existing.id);
      } else {
        const tag = await createAndAssign(trackId, name);
        if (!tag) {
          setMessage(INVALID_NAME);
          return;
        }
      }
      setDraft('');
    } catch {
      setMessage(WRITE_FAILED);
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.section}>
      {sorted.length > 0 ? (
        <View style={styles.grid}>
          {sorted.map((tag) => {
            const checked = assignedIds.has(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => void toggle(tag.id)}
                disabled={busy}
                accessibilityRole="checkbox"
                accessibilityLabel={tag.name}
                accessibilityState={{ checked, disabled: busy }}
                style={({ pressed }) => [
                  styles.check,
                  checked && styles.checkOn,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={checked ? colors.accent : colors.textDim}
                />
                <Text
                  style={[styles.checkLabel, checked && styles.checkLabelOn]}
                  numberOfLines={1}
                >
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.hint}>No tags yet. Create one below.</Text>
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
          accessibilityState={{ disabled: busy, busy: adding }}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  check: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff14',
    backgroundColor: colors.surface,
  },
  checkOn: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceHi,
  },
  checkLabel: {
    ...type.meta,
    color: colors.textDim,
    flexShrink: 1,
  },
  checkLabelOn: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});
