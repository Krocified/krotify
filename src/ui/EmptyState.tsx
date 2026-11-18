import { Ionicons } from '@react-native-vector-icons/ionicons';
import { memo, type ComponentProps, type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';
import { ui } from './styles';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title?: string;
  text?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  text,
  action,
  style,
}: Props) {
  return (
    <View style={[ui.empty, style]}>
      <Ionicons name={icon} size={34} color={colors.textDim} />
      {title ? <Text style={ui.emptyTitle}>{title}</Text> : null}
      {text ? <Text style={ui.emptyText}>{text}</Text> : null}
      {action}
    </View>
  );
});
