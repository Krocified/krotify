import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { SHUFFLE_ENABLED } from '../lib/features';
import { BlurPill } from './BlurPill';
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
  onAdd?: () => void;
  onPressArtwork?: () => void;
  disabled?: boolean;
};

export function CollectionHero({
  title,
  description,
  meta,
  artworkUri,
  fallbackHue,
  onPlay,
  onShuffle,
  onEdit,
  onAdd,
  onPressArtwork,
  disabled = false,
}: Props) {
  const cover = (
    <CoverArt
      hue={fallbackHue}
      title={title}
      size={92}
      radius={radius.coverLarge}
      uri={artworkUri}
    />
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        {onPressArtwork ? (
          <Pressable
            onPress={onPressArtwork}
            accessibilityRole="button"
            accessibilityLabel={`Change ${title} cover`}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            {cover}
          </Pressable>
        ) : (
          cover
        )}
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
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
        <BlurPill
          onPress={onPlay}
          disabled={disabled}
          accessibilityLabel={`Play ${title}`}
          accessibilityState={{ disabled }}
          fillColor={colors.accent}
          style={styles.play}
        >
          <Ionicons name="play" size={20} color={colors.text} />
        </BlurPill>

        {(SHUFFLE_ENABLED && onShuffle) || onEdit || onAdd ? (
          <BlurPill style={styles.group} contentStyle={styles.groupContent}>
            {SHUFFLE_ENABLED && onShuffle ? (
              <Pressable
                onPress={onShuffle}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Shuffle ${title}`}
                accessibilityState={{ disabled }}
                style={({ pressed }) => [
                  styles.groupButton,
                  disabled && styles.disabled,
                  pressed && !disabled && styles.pressed,
                ]}
              >
                <Ionicons name="shuffle" size={20} color={colors.text} />
              </Pressable>
            ) : null}
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${title}`}
                style={({ pressed }) => [styles.groupButton, pressed && styles.pressed]}
              >
                <Ionicons name="pencil" size={19} color={colors.text} />
              </Pressable>
            ) : null}
            {onAdd ? (
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel={`Add songs to ${title}`}
                style={({ pressed }) => [styles.groupButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </BlurPill>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    marginBottom: space.md,
    gap: space.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.display,
    fontSize: 22,
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
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  group: {
    height: 44,
    borderRadius: 22,
  },
  groupContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  disabled: {
    opacity: 0.4,
  },
});
