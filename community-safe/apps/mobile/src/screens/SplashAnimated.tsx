import { Audio } from './splashAudio';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

const TRIANGLE = require('../../assets/images/smc_triangle.png');
const WORD = require('../../assets/images/smc_text_white.png');

let played = false;
/** Animation jouée une seule fois par démarrage à froid : au démarrage à chaud, l'app s'affiche directement. */
export const splashPlayed = () => played;

// ───── Chronologie (secondes depuis le début), scène de référence 390 × 844 ─────
const CX = 195, CY = 372;
const TOTAL = 4.45; // 4.1 s d'animation + fondu de sortie de 0.35 s

// Courbes (CSS cubic-bezier) : fabriquées une fois, utilisables dans les worklets.
const E_DROP = Easing.bezier(0.2, 1.2, 0.3, 1).factory();
const E_SHOCK = Easing.bezier(0.1, 0.7, 0.3, 1).factory();
const E_TXT = Easing.bezier(0.2, 0.8, 0.2, 1).factory();
const E_EASE = Easing.bezier(0.25, 0.1, 0.25, 1).factory();
const E_LOAD = Easing.bezier(0.4, 0, 0.2, 1).factory();
const E_INOUT = Easing.bezier(0.42, 0, 0.58, 1).factory();
const E_OUT = Easing.bezier(0, 0, 0.58, 1).factory();

/** Progression 0 → 1 d'un segment [start, start + dur]. */
const seg = (t: number, start: number, dur: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (t - start) / dur));
};
/** Images clés avec une courbe par intervalle (comme les keyframes CSS). */
const kf = (p: number, times: number[], values: number[], ease: (x: number) => number) => {
  'worklet';
  for (let i = 1; i < times.length; i++) {
    if (p <= times[i]) {
      const local = (p - times[i - 1]) / (times[i] - times[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * ease(local);
    }
  }
  return values[values.length - 1];
};

const RAYS: [number, number][] = [[-5.0, 1.03], [22.4, 1.04], [49.6, 1.03], [71.4, 1.04], [98.3, 1.06], [123.1, 1.12], [155.6, 1.04], [177.2, 1.06], [204.2, 1.03], [235.4, 1.14], [256.8, 1.08], [278.1, 1.03], [306.8, 1.05], [338.1, 1.04]];
const PARTS: [number, number, number, number, string][] = [
  [-57, 115, 3, 1.07, '#FF2D55'], [149, 100, 4, 1.06, '#FFFFFF'], [-121, 68, 6, 1.06, '#FF2D55'], [97, 96, 3, 1.19, '#FFFFFF'], [130, 42, 4, 1.12, '#FF8FA8'],
  [-173, -45, 4, 1.08, '#FF2D55'], [-99, -119, 3, 1.19, '#FF2D55'], [52, 184, 6, 1.24, '#FFFFFF'], [-141, -84, 5, 1.11, '#FF8FA8'], [-44, -132, 5, 1.18, '#C084FC'],
  [-19, -143, 3, 1.08, '#FFFFFF'], [77, 130, 6, 1.16, '#FF4D6D'], [16, -178, 5, 1.14, '#C084FC'], [-149, -100, 6, 1.07, '#FF4D6D'], [157, -57, 3, 1.07, '#C084FC'],
  [-138, -183, 6, 1.12, '#FFFFFF'], [115, -99, 6, 1.14, '#FF2D55'], [87, 79, 5, 1.08, '#FF8FA8'], [-176, 132, 6, 1.07, '#FFFFFF'], [-117, 83, 4, 1.25, '#FF2D55'],
  [-28, 157, 5, 1.22, '#FFFFFF'], [124, -34, 4, 1.09, '#FF8FA8'], [209, 16, 4, 1.12, '#FF4D6D'], [106, 138, 5, 1.29, '#FF2D55'], [179, -58, 3, 1.16, '#FF2D55'], [-123, 99, 3, 1.17, '#FFFFFF'],
];
const WAVES: [number, string][] = [[1.02, '#FF6B8B'], [1.17, '#C084FC'], [1.32, '#FF2D55']];
const AURORAS: { x: number; y: number; r: number; color: string; start: number }[] = [
  { x: 50, y: 320, r: 170, color: '#7C3AED', start: 1.0 },
  { x: 350, y: 510, r: 150, color: '#C026D3', start: 1.25 },
  { x: 190, y: 680, r: 120, color: '#E11D48', start: 1.5 },
];

type Clock = ReturnType<typeof useSharedValue<number>>;

function Aurora({ t, k, x, y, r, color, start }: { t: Clock; k: number; x: number; y: number; r: number; color: string; start: number }) {
  const style = useAnimatedStyle(() => {
    const p = E_EASE(seg(t.value, start, 2.6));
    return { opacity: 0.34 * p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  const size = (r + 44) * 2 * k; // le flou (60 px) est rendu par un dégradé radial qui s'éteint en douceur
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (x - r - 44) * k, top: (y - r - 44) * k, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs><RadialGradient id={`au${start}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor={color} stopOpacity={1} /><Stop offset="0.62" stopColor={color} stopOpacity={0.85} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs>
        <Rect width={100} height={100} fill={`url(#au${start})`} />
      </Svg>
    </Animated.View>
  );
}

function Ray({ t, k, angle, d }: { t: Clock; k: number; angle: number; d: number }) {
  const style = useAnimatedStyle(() => {
    const p = E_OUT(seg(t.value, d, 0.6));
    return { opacity: interpolate(p, [0, 0.2, 1], [0, 1, 0], Extrapolation.CLAMP) };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (CX - 1) * k, top: (CY - 91) * k, width: 2 * k, height: 90 * k, borderRadius: k, transformOrigin: '50% 100%', transform: [{ rotate: `${angle}deg` }], backgroundColor: '#FF8FA8' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 2 90" preserveAspectRatio="none">
        <Defs><LinearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF8FA8" stopOpacity={0} /><Stop offset="1" stopColor="#FF8FA8" stopOpacity={1} /></LinearGradient></Defs>
        <Rect width={2} height={90} fill="url(#ray)" />
      </Svg>
    </Animated.View>
  );
}

function Particle({ t, k, dx, dy, s, d, color }: { t: Clock; k: number; dx: number; dy: number; s: number; d: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const raw = seg(t.value, d, 1.1);
    const p = E_SHOCK(raw);
    return { opacity: raw <= 0 ? 0 : 1 - p, transform: [{ translateX: dx * k * p }, { translateY: dy * k * p }, { scale: 1 - 0.8 * p }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (CX - s / 2) * k, top: (CY - s / 2) * k, width: s * k, height: s * k, borderRadius: s * k, backgroundColor: color }, style]} />;
}

function Wave({ t, k, start, color }: { t: Clock; k: number; start: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const raw = seg(t.value, start, 1.4);
    const p = E_SHOCK(raw);
    return { opacity: raw <= 0 ? 0 : 1 - p, transform: [{ scale: 0.5 + 10.5 * p }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (CX - 18) * k, top: (CY - 18) * k, width: 36 * k, height: 36 * k, borderRadius: 18 * k, borderWidth: 3, borderColor: color }, style]} />;
}

export function SplashAnimated({ onDone, freezeAt }: { onDone: () => void; freezeAt?: number }) {
  const { width, height } = useWindowDimensions();
  const k = width / 390;
  const yOff = (height - 844 * k) / 2; // la scène 390 × 844 est centrée verticalement
  const t = useSharedValue(freezeAt ?? 0);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => setReduceMotion(false)); }, []);

  // Le son est préchargé AVANT de lancer l'horloge : animation, son et haptique démarrent ensemble (t = 0).
  // Le son respecte le mode silencieux de l'iPhone.
  useEffect(() => {
    if (reduceMotion === null || freezeAt !== undefined) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stop = () => {};
    (async () => {
      const sound = await Audio.load();
      if (cancelled) { sound?.stop(); return; }
      played = true;
      const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => { try { fn(); } catch { /* le retour haptique n'est jamais bloquant */ } }, ms));
      if (sound) { sound.play(); stop = sound.stop; }
      at(200, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      at(600, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      at(1000, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      at(1750, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      if (reduceMotion) {
        // Animations réduites : état final affiché tout de suite, puis fondu vers l'app.
        t.value = 4.0;
        t.value = withDelay(1200, withTiming(TOTAL, { duration: 350, easing: Easing.linear }, (done) => { if (done) runOnJS(onDone)(); }));
      } else {
        t.value = withTiming(TOTAL, { duration: TOTAL * 1000, easing: Easing.linear }, (done) => { if (done) runOnJS(onDone)(); });
      }
    })();
    return () => { cancelled = true; timers.forEach(clearTimeout); stop(); };
  }, [reduceMotion, onDone, t, freezeAt]);

  const root = useAnimatedStyle(() => ({ opacity: 1 - seg(t.value, 4.1, 0.35) }));
  const led = useAnimatedStyle(() => {
    const p = seg(t.value, 0.2, 1.0);
    return { opacity: interpolate(p, [0, 0.12, 1], [0, 1, 1], Extrapolation.CLAMP), transform: [{ scale: interpolate(p, [0, 0.12, 0.28, 0.42, 0.58, 1], [0.4, 1, 1.5, 1, 1.7, 7], Extrapolation.CLAMP) }] };
  });
  const flash = useAnimatedStyle(() => ({ opacity: interpolate(seg(t.value, 1.0, 0.5), [0, 0.25, 1], [0, 0.9, 0], Extrapolation.CLAMP) }));
  // Arrivée du triangle : 0 → 60 % (échelle .15 → 1.18, −24° → +5°) puis 60 → 100 % (→ 1, 0°).
  const drop = useAnimatedStyle(() => {
    const p = seg(t.value, 1.0, 0.75);
    return {
      opacity: Math.min(1, kf(p, [0, 0.6, 1], [0, 1, 1], E_DROP)),
      transform: [{ scale: kf(p, [0, 0.6, 1], [0.15, 1.18, 1], E_DROP) }, { rotate: `${kf(p, [0, 0.6, 1], [-24, 5, 0], E_DROP)}deg` }],
    };
  });
  const alarm = useAnimatedStyle(() => {
    const p = seg(t.value, 1.7, 1.1);
    return { transform: [{ rotate: `${kf(p, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], [0, -9, 8, -6, 4, -2, 0], E_EASE)}deg` }] };
  });
  const breathe = useAnimatedStyle(() => {
    const tb = t.value - 2.9;
    const phase = tb > 0 ? (tb % 3.6) / 3.6 : 0;
    const s = kf(phase, [0, 0.5, 1], [1, 1.045, 1], E_INOUT);
    const g = (s - 1) / 0.045;
    return { transform: [{ scale: s }], shadowOpacity: 0.45 + 0.3 * g, shadowRadius: (15 + 7 * g) * k };
  });
  const word = useAnimatedStyle(() => {
    const p = E_TXT(seg(t.value, 1.75, 0.8));
    return { opacity: p, transform: [{ translateY: 18 * k * (1 - p) }, { scale: 0.94 + 0.06 * p }] };
  });
  const sheen = useAnimatedStyle(() => {
    const p = E_EASE(seg(t.value, 2.45, 0.9));
    return { transform: [{ translateX: (-120 + 420 * p) * k }, { skewX: '-18deg' }] };
  });
  const tag = useAnimatedStyle(() => {
    const p = E_TXT(seg(t.value, 2.7, 0.7));
    return { opacity: p, transform: [{ translateY: 14 * k * (1 - p) }] };
  });
  const loadBox = useAnimatedStyle(() => ({ opacity: seg(t.value, 2.6, 0.4) }));
  const loadFill = useAnimatedStyle(() => ({ transform: [{ scaleX: E_LOAD(seg(t.value, 2.7, 1.3)) }] }));

  const scene = useMemo(() => ({ position: 'absolute' as const, left: 0, top: yOff, width: 390 * k, height: 844 * k }), [k, yOff]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0316' }, root]} pointerEvents="none">
      <View style={scene}>
        {AURORAS.map((a) => <Aurora key={a.start} t={t} k={k} {...a} />)}
        <Animated.View style={[{ position: 'absolute', left: (CX - 8) * k, top: (CY - 8) * k, width: 16 * k, height: 16 * k, borderRadius: 8 * k, backgroundColor: '#FF2D55', boxShadow: '0 0 24px 6px rgba(255,45,85,0.9)' }, led]} />
        {RAYS.map(([a, d]) => <Ray key={a} t={t} k={k} angle={a} d={d} />)}
        {WAVES.map(([s, c]) => <Wave key={s} t={t} k={k} start={s} color={c} />)}
        {PARTS.map(([dx, dy, s, d, c], i) => <Particle key={i} t={t} k={k} dx={dx} dy={dy} s={s} d={d} color={c} />)}

        <Animated.View style={[{ position: 'absolute', left: 105 * k, top: 312 * k, width: 180 * k, height: 132 * k }, drop]}>
          <Animated.View style={[{ flex: 1, transformOrigin: '50% 80%' }, alarm]}>
            <Animated.View style={[{ flex: 1, transformOrigin: '50% 80%', shadowColor: '#FF2D55', shadowOffset: { width: 0, height: 12 * k } }, breathe]}>
              <Image source={TRIANGLE} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel="Logo SmC : triangle d'alerte" />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[{ position: 'absolute', left: 70 * k, top: 470 * k, width: 250 * k, height: 80 * k, overflow: 'hidden' }, word]}>
          <Image source={WORD} style={{ width: 250 * k, height: 80.4 * k }} resizeMode="contain" accessibilityLabel="SmC" />
          <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 90 * k }, sheen]}>
            <Svg width="100%" height="100%" viewBox="0 0 90 80" preserveAspectRatio="none">
              <Defs><LinearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#fff" stopOpacity={0} /><Stop offset="0.5" stopColor="#fff" stopOpacity={0.55} /><Stop offset="1" stopColor="#fff" stopOpacity={0} /></LinearGradient></Defs>
              <Rect width={90} height={80} fill="url(#sh)" />
            </Svg>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 590 * k, alignItems: 'center' }, tag]}>
          <Text style={{ fontSize: 17 * k, fontWeight: '600', letterSpacing: 0.2, color: 'rgba(255,255,255,0.76)' }}>
            Ne perds jamais <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>ta communauté</Text>
          </Text>
        </Animated.View>

        <Animated.View style={[{ position: 'absolute', left: 135 * k, top: 690 * k, width: 120 * k, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }, loadBox]}>
          <Animated.View style={[{ width: '100%', height: '100%', transformOrigin: '0% 50%' }, loadFill]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 3" preserveAspectRatio="none">
              <Defs><LinearGradient id="ld" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FF4D6D" /><Stop offset="1" stopColor="#C084FC" /></LinearGradient></Defs>
              <Rect width={100} height={3} fill="url(#ld)" />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, flash]}>
        <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
          <Defs><RadialGradient id="fl" cx="195" cy="371" r="511" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor="#fff" stopOpacity={1} /><Stop offset="0.18" stopColor="#FF7896" stopOpacity={0.8} /><Stop offset="0.6" stopColor="#FF2D55" stopOpacity={0} /></RadialGradient></Defs>
          <Rect width={390} height={844} fill="url(#fl)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
