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
import { colors, radius, space, type } from '../theme';
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
    <Sheet visible={visible} title="New playlist" onClose={handleClose}>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
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
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => void create()}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={handleClose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [
            styles.secondary,
            styles.action,
            busy && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void create()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Create playlist"
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [
            styles.primary,
            styles.action,
            busy && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>Create</Text>
          )}
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  label: {
    ...type.meta,
    color: colors.textDim,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  error: {
    ...type.meta,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  action: {
    flex: 1,
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  primaryText: {
    ...type.body,
    color: colors.text,
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  secondaryText: {
    ...type.body,
    color: colors.text,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
