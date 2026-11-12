import { useMemo, useState } from 'react';
import { Animated, type LayoutChangeEvent } from 'react-native';

export function useScrollProgress() {
  const [scrollY] = useState(() => new Animated.Value(0));
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const scrollHandlers = useMemo(
    () => ({
      onScroll: Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false },
      ),
      onContentSizeChange: (_width: number, height: number) => setContentHeight(height),
      onLayout: (event: LayoutChangeEvent) => setViewportHeight(event.nativeEvent.layout.height),
      scrollEventThrottle: 16,
    }),
    [scrollY],
  );

  return { scrollY, contentHeight, viewportHeight, scrollHandlers };
}
