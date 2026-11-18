import { BlurView } from 'expo-blur';
import type { ComponentRef, ReactNode, RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
  intensity?: number;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
};

export function BlurPill({
  children,
  onPress,
  onLongPress,
  disabled = false,
  blurTarget,
  intensity = 40,
  fillColor = 'rgba(22,22,29,0.35)',
  style,
  contentStyle,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const body = (
    <>
      {blurTarget ? (
        <BlurView
          pointerEvents="none"
          intensity={intensity}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: fillColor }]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );

  if (!onPress && !onLongPress) {
    return (
      <View
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={[styles.pill, disabled && styles.disabled, style]}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      style={({ pressed }) => [
        styles.pill,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffffff14',
    backgroundColor: 'rgba(22,22,29,0.55)',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
