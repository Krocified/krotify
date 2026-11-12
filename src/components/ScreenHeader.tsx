import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';

type Props = {
  leading: ReactNode;
  title?: string;
  trailing?: ReactNode;
};

export function ScreenHeader({ leading, title, trailing }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        <View style={styles.leading}>
          {leading}
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
    ...type.display,
    color: colors.text,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
});
