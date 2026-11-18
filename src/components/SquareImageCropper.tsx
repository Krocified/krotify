import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { baseScaleFor, clampTransform, computeCropRect } from '../lib/crop';
import { cropSquare, normalizeCropSource, type CropSource } from '../library/cropArtwork';
import { colors, radius, space, type } from '../theme';

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onDone: (file: File) => void;
};

function discard(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}

export function SquareImageCropper({ visible, uri, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const viewport = Math.min(width - space.xl, 420);
  const [source, setSource] = useState<CropSource | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const showSeq = useRef(0);
  const normalizedRef = useRef<string | null>(null);

  function resetTransform() {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    startScale.value = 1;
    startX.value = 0;
    startY.value = 0;
  }

  function handleShow() {
    const seq = (showSeq.current += 1);
    resetTransform();
    imageWidth.value = 0;
    imageHeight.value = 0;
    setSaving(false);
    setError(null);
    setSource(null);
    discard(normalizedRef.current);
    normalizedRef.current = null;
    if (!uri) return;
    setPreparing(true);
    normalizeCropSource(uri)
      .then((next) => {
        if (seq !== showSeq.current) {
          discard(next.uri);
          return;
        }
        normalizedRef.current = next.uri;
        imageWidth.value = next.width;
        imageHeight.value = next.height;
        setSource(next);
      })
      .catch(() => {
        if (seq === showSeq.current) setError('Could not read that image.');
      })
      .finally(() => {
        if (seq === showSeq.current) setPreparing(false);
      });
  }

  function finish() {
    showSeq.current += 1;
    discard(normalizedRef.current);
    normalizedRef.current = null;
    setSource(null);
  }

  function cancel() {
    if (saving) return;
    finish();
    onCancel();
  }

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      const next = clampTransform({
        imageWidth: imageWidth.value,
        imageHeight: imageHeight.value,
        viewport,
        transform: {
          scale: startScale.value * event.scale,
          translateX: translateX.value,
          translateY: translateY.value,
        },
      });
      scale.value = next.scale;
      translateX.value = next.translateX;
      translateY.value = next.translateY;
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = clampTransform({
        imageWidth: imageWidth.value,
        imageHeight: imageHeight.value,
        viewport,
        transform: {
          scale: scale.value,
          translateX: startX.value + event.translationX,
          translateY: startY.value + event.translationY,
        },
      });
      translateX.value = next.translateX;
      translateY.value = next.translateY;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  async function save() {
    if (!source || saving) return;
    setSaving(true);
    setError(null);
    try {
      const rect = computeCropRect({
        imageWidth: source.width,
        imageHeight: source.height,
        viewport,
        transform: {
          scale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
        },
      });
      const file = await cropSquare(source.uri, rect);
      finish();
      onDone(file);
    } catch {
      setError('Could not crop the image.');
    } finally {
      setSaving(false);
    }
  }

  const base = source ? baseScaleFor(source.width, source.height, viewport) : 0;
  const imageWidthPx = source ? source.width * base : 0;
  const imageHeightPx = source ? source.height * base : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onShow={handleShow}
      onRequestClose={cancel}
    >
      <View style={styles.root}>
        <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
          <Pressable
            onPress={cancel}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityState={{ disabled: saving }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Crop cover</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.stage}>
          <View
            style={[
              styles.viewport,
              { width: viewport, height: viewport, borderRadius: radius.coverLarge },
            ]}
          >
            {source ? (
              <GestureDetector gesture={gesture}>
                <Animated.Image
                  source={{ uri: source.uri }}
                  resizeMode="stretch"
                  style={[
                    styles.image,
                    {
                      width: imageWidthPx,
                      height: imageHeightPx,
                      left: (viewport - imageWidthPx) / 2,
                      top: (viewport - imageHeightPx) / 2,
                    },
                    imageStyle,
                  ]}
                  accessible={false}
                />
              </GestureDetector>
            ) : null}
            {preparing ? <ActivityIndicator color={colors.accent} /> : null}
            <View pointerEvents="none" style={styles.frame} />
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>Pinch to zoom, drag to reposition.</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={cancel}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [
                styles.secondary,
                styles.action,
                saving && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={saving || !source}
              accessibilityRole="button"
              accessibilityLabel="Save square"
              accessibilityState={{ disabled: saving || !source, busy: saving }}
              style={({ pressed }) => [
                styles.primary,
                styles.action,
                (saving || !source) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.primaryText}>Save square</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  title: {
    ...type.body,
    color: colors.text,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewport: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
  },
  frame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: '#ffffff40',
    borderRadius: radius.coverLarge,
  },
  footer: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  hint: {
    ...type.meta,
    color: colors.textDim,
    textAlign: 'center',
  },
  error: {
    ...type.meta,
    color: colors.danger,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  action: {
    flex: 1,
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.screen,
    backgroundColor: colors.accent,
  },
  primaryText: {
    ...type.body,
    color: colors.text,
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.screen,
    backgroundColor: colors.surfaceHi,
  },
  secondaryText: {
    ...type.body,
    color: colors.text,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
