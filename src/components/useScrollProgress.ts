import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

export function useScrollProgress() {
  const scrollY = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const scrollHandlers = useMemo(
    () => ({
      onScroll,
      onContentSizeChange: (_width: number, height: number) => setContentHeight(height),
      onLayout: (event: LayoutChangeEvent) => setViewportHeight(event.nativeEvent.layout.height),
      scrollEventThrottle: 16,
    }),
    [onScroll],
  );

  return { scrollY, contentHeight, viewportHeight, scrollHandlers };
}
