import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import { colors } from '../theme';
import { fitMarqueeText } from '../lib/marquee';

type Props = {
  text: string;
  style?: TextStyle | TextStyle[];
  speed?: number;
  startPauseMs?: number;
  endPauseMs?: number;
};

const RETURN_MS = 520;

export function MarqueeText({
  text,
  style,
  speed = 34,
  startPauseMs = 1400,
  endPauseMs = 2200,
}: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [measured, setMeasured] = useState<{ text: string; width: number }>({
    text: '',
    width: 0,
  });
  const [translateX] = useState(() => new Animated.Value(0));
  const { text: displayText, tooLong } = fitMarqueeText(text);
  const textWidth = measured.text === displayText ? measured.width : 0;
  const overflow = textWidth > containerWidth + 1 && containerWidth > 0;

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!overflow) return undefined;
    const distance = textWidth - containerWidth;
    const duration = Math.max(3200, (distance / speed) * 1000);
    const useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(startPauseMs),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver,
        }),
        Animated.delay(endPauseMs),
        Animated.timing(translateX, {
          toValue: 0,
          duration: RETURN_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [
    containerWidth,
    endPauseMs,
    overflow,
    startPauseMs,
    speed,
    text,
    textWidth,
    translateX,
  ]);

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const handleContentSize = (width: number) => {
    setMeasured((previous) =>
      previous.text === displayText && Math.abs(previous.width - width) < 1
        ? previous
        : { text: displayText, width },
    );
  };

  const handleMeasureLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) handleContentSize(width);
  };

  if (tooLong) {
    return (
      <Text
        numberOfLines={1}
        accessibilityLabel="Text too long, maximum 250 characters"
        style={[style, styles.tooLong]}
      >
        Text too long (max 250 characters)
      </Text>
    );
  }

  return (
    <View style={styles.wrap} onLayout={handleContainerLayout}>
      {overflow ? (
        <Animated.View style={{ width: textWidth, transform: [{ translateX }] }}>
          <Text
            numberOfLines={1}
            accessibilityLabel={text}
            style={[style, { width: textWidth }]}
          >
            {displayText}
          </Text>
        </Animated.View>
      ) : (
        <Text numberOfLines={1} accessibilityLabel={displayText} style={style}>
          {displayText}
        </Text>
      )}
      <View style={styles.measureRow} pointerEvents="none" accessible={false}>
        <Text numberOfLines={1} accessible={false} style={style} onLayout={handleMeasureLayout}>
          {displayText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  measureRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    flexDirection: 'row',
    opacity: 0,
  },
  tooLong: {
    color: colors.danger,
  },
});
