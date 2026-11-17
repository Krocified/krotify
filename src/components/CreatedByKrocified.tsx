import { StyleSheet, Text } from 'react-native';
import { colors, space, type } from '../theme';

export function CreatedByKrocified() {
  return <Text style={styles.text}>Created by Krocified</Text>;
}

const styles = StyleSheet.create({
  text: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: space.md,
  },
});
