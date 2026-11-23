import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, space, type } from '../theme';
import { ui } from '../ui/styles';
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
        <Sheet variant="dialog" visible={visible} title="Paste lyrics" onClose={close}
      footer={
        <>
          <View style={[ui.actions, styles.actions]}>
            <Pressable
              onPress={close}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [ui.secondaryButton, styles.action, pressed && ui.pressed]}
            >
              <Text style={ui.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={busy || text.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel="Add lyrics"
              style={({ pressed }) => [
                ui.primaryButton,
                styles.action,
                (busy || text.trim().length === 0) && ui.disabled,
                pressed && ui.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={ui.primaryButtonText}>Add lyrics</Text>
              )}
            </Pressable>
          </View>
        </>
      }
    >
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
        style={[ui.input, styles.input]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    minHeight: 180,
    padding: space.md,
    marginHorizontal: space.sm,
  },
  error: {
    ...type.meta,
    color: colors.danger,
    paddingHorizontal: space.sm,
  },
  actions: {
    padding: space.sm,
  },
  action: {
    flex: 1,
  },
});
