import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TECH_STACK } from '../lib/techStack';
import { colors, radius, space, type } from '../theme';
import { CreatedByKrocified } from './CreatedByKrocified';
import { BackPill } from './ScreenHeader';

type Props = {
  visible: boolean;
  onBack: () => void;
};

export function TechStackScreen({ visible, onBack }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.root, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={styles.title}>Tech stack</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      >
        <View style={styles.card}>
          {TECH_STACK.map((item) => (
            <View
              key={item.concern}
              style={styles.row}
              accessible
              accessibilityLabel={`${item.concern}: ${item.choice}. ${item.why}`}
            >
              <Text style={styles.concern}>{item.concern}</Text>
              <Text style={styles.choice}>{item.choice}</Text>
              <Text style={styles.why}>{item.why}</Text>
            </View>
          ))}
        </View>
        <CreatedByKrocified />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
  },
  hidden: {
    display: 'none',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  iconButton: {
    width: 44,
    height: 44,
  },
  content: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
  },
  row: {
    gap: space.xs,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ffffff10',
  },
  concern: {
    ...type.meta,
    color: colors.textDim,
  },
  choice: {
    ...type.body,
    color: colors.text,
  },
  why: {
    ...type.meta,
    color: colors.textDim,
  },
});
