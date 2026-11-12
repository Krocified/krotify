import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { coverColors, coverInitial } from '../lib/cover';

type Props = {
  hue: number;
  title: string;
  size: number;
  radius: number;
  uri?: string;
};

export function CoverArt({ hue, title, size, radius, uri }: Props) {
  const gradient = coverColors(hue);
  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: radius, backgroundColor: gradient[0] },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          accessible={false}
        />
      ) : (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderRadius: radius }]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.3 }]}>
            {coverInitial(title)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '800',
    includeFontPadding: false,
  },
});
