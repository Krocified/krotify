import { Ionicons } from '@react-native-vector-icons/ionicons';
import { memo, type ComponentProps } from 'react';
import {
  Pressable,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';
import { ui } from './styles';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityState?: AccessibilityState;
};

export const IconButton = memo(function IconButton({
  icon,
  label,
  onPress,
  size = 22,
  color = colors.textDim,
  disabled = false,
  selected = false,
  style,
  accessibilityState,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState ?? (selected ? { selected } : undefined)}
      style={({ pressed }) => [
        ui.iconButton,
        disabled && ui.disabled,
        pressed && !disabled && ui.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
});
