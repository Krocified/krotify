import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export type KeyboardState = {
  height: number;
  screenY: number | null;
};

export function useKeyboardHeight(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ height: 0, screenY: null });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setState({
        height: event.endCoordinates.height,
        screenY: event.endCoordinates.screenY ?? null,
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setState({ height: 0, screenY: null });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return state;
}
