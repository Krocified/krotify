import { StyleSheet } from 'react-native';
import { colors, radius, space, type } from '../theme';

export const ui = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
  },
  hidden: {
    display: 'none',
  },
  flex: {
    flex: 1,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  content: {
    paddingHorizontal: space.md,
    gap: space.md,
  },
  sectionTitle: {
    ...type.body,
    color: colors.text,
    marginTop: space.sm,
  },
  settingsTitle: {
    ...type.meta,
    color: colors.textDim,
    marginTop: space.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.screen,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.md,
  },
  stackRow: {
    gap: space.sm,
    padding: space.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceHi,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  rowTitle: {
    ...type.body,
    color: colors.text,
  },
  rowMeta: {
    ...type.meta,
    color: colors.textDim,
  },
  rowValue: {
    ...type.meta,
    color: colors.textDim,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  action: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...type.meta,
    color: colors.accent2,
  },
  pressed: {
    opacity: 0.75,
  },
  pressedSurface: {
    backgroundColor: colors.surfaceHi,
  },
  disabled: {
    opacity: 0.4,
  },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.xl * 2,
  },
  emptyTitle: {
    ...type.body,
    color: colors.text,
  },
  emptyText: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  field: {
    gap: space.xs,
  },
  fieldLabel: {
    ...type.meta,
    color: colors.textDim,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.screen,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  primaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    ...type.body,
    color: colors.text,
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  secondaryButtonText: {
    ...type.body,
    color: colors.text,
    textAlign: 'center',
  },
});
