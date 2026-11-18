import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TECH_STACK } from '../lib/techStack';
import { colors, space, type } from '../theme';
import { ui } from '../ui/styles';
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
      style={[ui.overlay, !visible && ui.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[ui.header, { paddingTop: insets.top + space.sm }]}>
        <BackPill onPress={onBack} />
        <Text style={ui.title}>Tech stack</Text>
        <View style={ui.iconButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[ui.content, { paddingBottom: insets.bottom + space.xl }]}
      >
        <View style={ui.card}>
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
