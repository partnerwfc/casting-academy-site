import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const LOGO = require('../../assets/images/logo-dark.png');
let played = false;
export const openingPlayed = () => played;

// Animation d'ouverture : le logo SmC apparaît en rebond sur le fond violet, l'halo rouge pulse, puis l'écran se dissout.
export function OpeningAnimation({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.55)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    played = true;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      ]),
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]), { iterations: 1 }),
      Animated.timing(out, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [fade, glow, onDone, out, scale]);
  const pulse = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out, backgroundColor: '#170B2F' }]} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs><LinearGradient id="o" x1="0.3" y1="0" x2="0.8" y2="1"><Stop offset="0" stopColor="#0B0618" /><Stop offset="0.6" stopColor="#1D0F45" /><Stop offset="1" stopColor="#6D28D9" /></LinearGradient></Defs>
        <Rect width={10} height={10} fill="url(#o)" />
        <Circle cx={5} cy={4.4} r={2.6} fill="#E11D48" fillOpacity={0.12} />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }, { scale: pulse }] }}>
          <Image source={LOGO} style={{ width: 210, height: 205 }} resizeMode="contain" accessibilityLabel="SaveMyCommunity" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
