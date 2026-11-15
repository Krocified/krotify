import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '../theme';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from './TabBar';

type Props = {
  visible: boolean;
  message: string;
  onHidden?: () => void;
};

const FADE_IN_MS = 150;
const FADE_OUT_MS = 200;
const VISIBLE_MS = 1800;

export function Toast({ visible, message, onHidden }: Props) {
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver,
      }).start();
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver,
      }).start(({ finished }) => {
        if (finished) onHiddenRef.current?.();
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [opacity, visible]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom:
            insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + space.md,
        },
      ]}
    >
      <Animated.View style={[styles.pill, { opacity }]}>
        <Text style={styles.text} accessibilityLiveRegion="polite">
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space.md,
    zIndex: 30,
  },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.screen,
    backgroundColor: 'rgba(31,31,41,0.95)',
    borderWidth: 1,
    borderColor: '#ffffff14',
  },
  text: {
    ...type.meta,
    color: colors.text,
  },
});
