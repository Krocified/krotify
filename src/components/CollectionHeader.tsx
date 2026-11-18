import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { CoverArt } from './CoverArt';

type Props = {
  title: string;
  description?: string;
  meta: string;
  artworkUri?: string;
  fallbackHue: number;
  onPlay: () => void;
  onShuffle?: () => void;
  onEdit?: () => void;
  onPressArtwork?: () => void;
  disabled?: boolean;
};

export function CollectionHeader({
  title,
  description,
  meta,
  artworkUri,
  fallbackHue,
  onPlay,
  onShuffle,
  onEdit,
  onPressArtwork,
  disabled = false,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        {onPressArtwork ? (
          <Pressable
            onPress={onPressArtwork}
            accessibilityRole="button"
            accessibilityLabel="Change artist cover"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <CoverArt
              hue={fallbackHue}
              title={title}
              size={140}
              radius={radius.coverLarge}
              uri={artworkUri}
            />
          </Pressable>
        ) : (
          <CoverArt
            hue={fallbackHue}
            title={title}
            size={140}
            radius={radius.coverLarge}
            uri={artworkUri}
          />
        )}
        <View style={styles.heroText}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onPlay}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Play ${title}`}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            styles.play,
            disabled && styles.disabled,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <Ionicons name="play" size={20} color={colors.text} />
          <Text style={styles.playLabel}>Play</Text>
        </Pressable>
        {onShuffle ? (
          <Pressable
            onPress={onShuffle}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Shuffle ${title}`}
            accessibilityState={{ disabled }}
            style={({ pressed }) => [
              styles.secondary,
              disabled && styles.disabled,
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Ionicons name="shuffle" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title}`}
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
          >
            <Ionicons name="pencil" size={20} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  heroText: {
    flex: 1,
    gap: space.xs,
  },
  title: {
    ...type.display,
    color: colors.text,
    letterSpacing: -0.5,
  },
  description: {
    ...type.meta,
    color: colors.textDim,
    lineHeight: 18,
  },
  meta: {
    ...type.meta,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  play: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: 26,
    backgroundColor: colors.accent,
  },
  playLabel: {
    ...type.body,
    color: colors.text,
  },
  secondary: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.surfaceHi,
    backgroundColor: 'transparent',
  },
  edit: {
    width: 44,
    height: 44,
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
