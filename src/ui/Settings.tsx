import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ui } from './styles';

type SectionProps = {
  title?: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SectionProps) {
  return (
    <>
      {title ? <Text style={ui.settingsTitle}>{title}</Text> : null}
      <View style={ui.card}>{children}</View>
    </>
  );
}

type RowProps = {
  title: string;
  meta?: ReactNode;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessible?: boolean;
  trailing?: ReactNode;
};

export const SettingsRow = memo(function SettingsRow({
  title,
  meta,
  value,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessible = false,
  trailing,
}: RowProps) {
  const content = (
    <>
      <View style={ui.rowText}>
        <Text style={ui.rowTitle}>{title}</Text>
        {meta ? typeof meta === 'string' ? <Text style={ui.rowMeta}>{meta}</Text> : meta : null}
      </View>
      {trailing ?? (value ? <Text style={ui.rowValue}>{value}</Text> : null)}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[ui.row, disabled && ui.rowDisabled]}
        accessible={accessible || accessibilityLabel !== undefined}
        accessibilityLabel={accessible || accessibilityLabel !== undefined ? accessibilityLabel ?? title : undefined}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        ui.row,
        disabled && ui.rowDisabled,
        pressed && !disabled && ui.rowPressed,
      ]}
    >
      {content}
    </Pressable>
  );
});
