import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Text,
  View,
  useWindowDimensions,
  type HostInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetKeyboardMetrics } from '../lib/sheetKeyboard';
import { colors, radius, space, type } from '../theme';
import { useActiveBlurTarget } from '../ui/blurTargetContext';
import { useKeyboardHeight } from './useKeyboardHeight';

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  variant?: 'sheet' | 'dialog';
  children: ReactNode;
};

const DURATION = 200;
const PANEL_OFFSET = 420;

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled'));
}

export function Sheet({ visible, title, onClose, variant = 'sheet', children }: Props) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const metrics = sheetKeyboardMetrics({
    keyboardHeight: keyboard.height,
    keyboardScreenY: keyboard.screenY,
    bottomInset: insets.bottom,
    viewportHeight,
  });
  const keyboardGap = keyboard.height > 0 ? space.sm : 0;
  const isDialog = variant === 'dialog';
  const blurTarget = useActiveBlurTarget();
  const [anim] = useState(() => new Animated.Value(0));
  const panelRef = useRef<HostInstance>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(anim, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [anim, visible]);

  useEffect(() => {
    if (!visible || keyboard.height <= 0) return;
    const timer = setTimeout(() => {
      const handle = TextInput.State.currentlyFocusedInput();
      if (handle) {
        try {
          scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(handle, 24, true);
        } catch {}
      }
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [keyboard.height, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const panel = panelRef.current as unknown as HTMLElement | null;
    if (!panel) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.setAttribute('tabindex', '-1');
    (focusableElements(panel)[0] ?? panel).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableElements(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          isDialog && styles.rootDialog,
          isDialog && { paddingBottom: metrics.lift },
        ]}
      >
        <Animated.View
          style={[styles.backdrop, isDialog && styles.backdropDialog, { opacity: anim }]}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          focusable={false}
        />
        <Animated.View
          ref={panelRef}
          accessibilityViewIsModal
          importantForAccessibility="yes"
          style={[
            styles.panel,
            isDialog && styles.dialog,
            isDialog
              ? { maxHeight: metrics.maxHeight - keyboardGap, paddingBottom: space.lg }
              : {
                  paddingBottom:
                    keyboard.height > 0 ? space.md : insets.bottom + space.md,
                  maxHeight: metrics.maxHeight - keyboardGap,
                  marginBottom: metrics.lift + keyboardGap,
                },
            {
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [isDialog ? 24 : PANEL_OFFSET, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {isDialog && blurTarget ? (
            <BlurView
              pointerEvents="none"
              intensity={40}
              tint="dark"
              blurMethod="dimezisBlurViewSdk31Plus"
              blurTarget={blurTarget}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {isDialog ? <View pointerEvents="none" style={styles.dialogFill} /> : null}
          {isDialog ? null : <View style={styles.grabber} />}
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rootDialog: {
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  backdropDialog: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    overflow: 'hidden',
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: radius.screen,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  dialogFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(22, 22, 29, 0.24)',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHi,
    marginBottom: space.sm,
  },
  title: {
    ...type.body,
    color: colors.text,
    paddingVertical: space.sm,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  content: {
    gap: space.sm,
  },
});
