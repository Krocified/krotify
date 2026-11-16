import { StyleSheet, Text, View } from 'react-native';
import { useTags } from '../tags/TagProvider';
import { colors, space, type } from '../theme';
import { TagPicker } from './TagPicker';

export type TagEditorProps = {
  trackId: string;
  readOnly?: boolean;
};

export function TagEditor({ trackId, readOnly = false }: TagEditorProps) {
  const { tagsFor } = useTags();
  const assigned = tagsFor(trackId);

  if (readOnly) {
    if (assigned.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Tags</Text>
        <View style={styles.chips}>
          {assigned.map((tag) => (
            <View key={tag.id} style={styles.chip} accessible accessibilityLabel={tag.name}>
              <Text style={styles.chipText} numberOfLines={1}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Tags</Text>
      <TagPicker trackId={trackId} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  label: {
    ...type.meta,
    color: colors.textDim,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceHi,
  },
  chipText: {
    ...type.meta,
    color: colors.text,
  },
});
