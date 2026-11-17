import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
};

export function PasteLyricsSheet({ visible, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setText('');
    setError(null);
    onClose();
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      setText('');
      onClose();
    } catch (next) {
      setError(next instanceof Error ? next.message : 'Could not read those lyrics.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Paste lyrics" onClose={close}>
      <Text style={styles.hint}>LRC or YAML. The format is detected automatically.</Text>
      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value);
          setError(null);
        }}
        multiline
        autoFocus
        textAlignVertical="top"
        placeholder={'[00:12.00]First line\nor\nlines:\n  - time: 0:12\n    text: First line'}
        placeholderTextColor={colors.textDim}
        editable={!busy}
        accessibilityLabel="Paste lyrics text"
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          onPress={close}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void submit()}
          disabled={busy || text.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Add lyrics"
          style={({ pressed }) => [
            styles.primary,
            (busy || text.trim().length === 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>Add lyrics</Text>
          )}
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...type.meta,
    color: colors.textDim,
    paddingHorizontal: space.sm,
  },
  input: {
    ...type.body,
    minHeight: 180,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    padding: space.md,
    marginHorizontal: space.sm,
  },
  error: {
    ...type.meta,
    color: colors.danger,
    paddingHorizontal: space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  secondaryText: {
    ...type.body,
    color: colors.text,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  primaryText: {
    ...type.body,
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
