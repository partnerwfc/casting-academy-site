import type { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFor, radius, space, useColors } from '@/lib/theme';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const c = useColors();
  const pad = padded ? { padding: space.lg, gap: space.lg } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { paddingBottom: space.xxl }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'small' | 'hero';
export function T({ v = 'body', style, children, center }: { v?: Variant; style?: StyleProp<TextStyle>; children: ReactNode; center?: boolean }) {
  const c = useColors();
  const base: Record<Variant, TextStyle> = {
    hero: { fontSize: 34, fontWeight: '800', color: c.text, letterSpacing: -0.8, lineHeight: 40 },
    title: { fontSize: 26, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
    heading: { fontSize: 17, fontWeight: '600', color: c.text },
    body: { fontSize: 16, color: c.text, lineHeight: 23 },
    muted: { fontSize: 15, color: c.muted, lineHeight: 21 },
    small: { fontSize: 13, color: c.muted, lineHeight: 18 },
  };
  const merged = StyleSheet.flatten([base[v], center && { textAlign: 'center' }, style]) as TextStyle;
  const { fontWeight, ...rest } = merged;
  return <Text style={[rest, { fontFamily: fontFor(fontWeight) }]}>{children}</Text>;
}

export function Button({
  label, onPress, kind = 'primary', loading, disabled, style,
}: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'sos' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.primarySoft, sos: c.sos, ghost: 'transparent', danger: 'transparent' }[kind];
  const fg = { primary: c.onPrimary, secondary: c.primary, sos: '#FFFFFF', ghost: c.primary, danger: c.sos }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 16, fontFamily: fontFor(700) }}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'soft' | 'sos' }) {
  const c = useColors();
  const bg = tone === 'soft' ? c.primarySoft : tone === 'sos' ? c.sosSoft : c.card;
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: tone ? 'transparent' : c.border }, style]}>{children}</View>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const c = useColors();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="small" style={{ fontWeight: '600', color: c.text }}>{label}</T> : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        {...rest}
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }, style]}
      />
    </View>
  );
}

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const c = useColors();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.primary, fontFamily: fontFor(700), fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'sos' }) {
  const c = useColors();
  const fg = { neutral: c.muted, primary: c.primary, success: c.success, sos: c.sos }[tone];
  const bg = { neutral: c.surface, primary: c.primarySoft, success: c.primarySoft, sos: c.sosSoft }[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 12, fontFamily: fontFor(700) }}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1,
        borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.bg,
      }}>
      <Text style={{ color: selected ? c.primary : c.text, fontSize: 14, fontFamily: fontFor(500) }}>{label}</Text>
    </Pressable>
  );
}

export function SwitchRow({ title, desc, value, onChange }: { title: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="heading">{title}</T>
        {desc ? <T v="small">{desc}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary }} accessibilityLabel={title} />
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="title" style={{ fontSize: 22 }}>{value}</T>
      <T v="small">{label}</T>
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}><ActivityIndicator color={c.primary} /></View>;
}

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <Image source={require('../../assets/images/icon.png')} style={{ width: size, height: size, borderRadius: size * 0.225 }} accessibilityLabel="SaveMyCommunity" />
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Inter_400Regular' },
});
