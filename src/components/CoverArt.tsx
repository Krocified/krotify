import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
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
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(uri));
  const showImage = uri !== undefined && uri !== failedUri;

  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: radius, backgroundColor: gradient[0] },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderRadius: radius }]}
      >
        <Text style={[styles.initial, { fontSize: size * 0.3 }]}>{coverInitial(title)}</Text>
      </LinearGradient>
      {showImage ? (
        <>
          <Image
            source={{ uri: uri as string }}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailedUri(uri ?? null);
            }}
            style={[styles.image, { width: size, height: size, borderRadius: radius }]}
            accessible={false}
          />
          {loading ? (
            <View style={styles.spinner} pointerEvents="none">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </>
      ) : null}
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
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
