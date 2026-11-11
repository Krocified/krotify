import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

export function AppShell() {
  return (
    <View style={styles.root}>
      <Text style={styles.wordmark}>krotify</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: colors.text, fontSize: 30, fontWeight: '700' },
});
