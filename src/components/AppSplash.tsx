import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors } from '../theme';

type Props = {
  onDone: () => void;
};

const HOLD_MS = 850;
const EXIT_MS = 320;

export function AppSplash({ onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const [fade] = useState(() => new Animated.Value(1));
  const [intro] = useState(() => new Animated.Value(0));
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    Animated.timing(intro, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: useNative,
      }).start(({ finished }) => {
        if (finished) doneRef.current();
      });
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [fade, intro]);

  const artSize = Math.min(Math.min(width, height) * 0.6, 340);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} accessibilityViewIsModal>
      <Image
        source={require('../../assets/krotifybg.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessible={false}
      />
      <LinearGradient
        colors={['#0B0B0FCC', '#0B0B0F44', '#0B0B0FEE']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <Animated.View
          style={{
            opacity: intro,
            transform: [
              {
                scale: intro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          }}
        >
          <Image
            source={require('../../assets/krotify.png')}
            style={[
              styles.art,
              { width: artSize, height: artSize, borderRadius: artSize * 0.09 },
            ]}
            resizeMode="cover"
            accessible={false}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 18,
  },
  art: {
    borderWidth: 1,
    borderColor: '#ffffff24',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
});
