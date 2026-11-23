import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createPlaylist, type Playlist } from '../db/repo';
import { colors, space, type } from '../theme';
import { ui } from '../ui/styles';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (playlist: Playlist) => void;
};

export function PlaylistCreateSheet({ visible, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setName('');
    setBusy(false);
    setError(null);
    onClose();
  }

  async function create() {
    if (busy) return;
    const nextName = name.trim();
    if (!nextName) {
      setError('Enter a playlist name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const playlist = await createPlaylist(nextName);
      onCreated(playlist);
      setName('');
    } catch {
      setError('Could not create the playlist.');
    } finally {
      setBusy(false);
    }
  }

  return (
        <Sheet variant="dialog" visible={visible} title="New playlist" onClose={handleClose}
      footer={
        <>
          <View style={[ui.actions, styles.actions]}>
            <Pressable
              onPress={handleClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityState={{ disabled: busy }}
              style={({ pressed }) => [
                ui.secondaryButton,
                styles.action,
                busy && ui.disabled,
                pressed && ui.pressed,
              ]}
            >
              <Text style={ui.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void create()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Create playlist"
              accessibilityState={{ disabled: busy, busy }}
              style={({ pressed }) => [
                ui.primaryButton,
                styles.action,
                busy && ui.disabled,
                pressed && ui.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={ui.primaryButtonText}>Create</Text>
              )}
            </Pressable>
          </View>
        </>
      }
    >
      <View style={ui.field}>
        <Text style={ui.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          maxLength={60}
          autoFocus
          placeholder="Playlist name"
          placeholderTextColor={colors.textDim}
          style={ui.input}
          returnKeyType="done"
          onSubmitEditing={() => void create()}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

    </Sheet>
  );
}

const styles = StyleSheet.create({
  error: {
    ...type.meta,
    color: colors.danger,
  },
  actions: {
    marginTop: space.sm,
  },
  action: {
    flex: 1,
  },
});
