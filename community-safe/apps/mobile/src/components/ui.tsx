import type { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFor, radius, space, useColors } from '@/lib/theme';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const c = useColors();
  const pad = padded ? { padding: space.lg, gap: space.lg } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }} edges={['top', 'left', 'right']}>
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
    title: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.6 },
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
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'sos' | 'ghost' | 'danger' | 'neutral';
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.primarySoft, sos: c.sos, ghost: 'transparent', danger: 'transparent', neutral: '#EEEFF5' }[kind];
  const fg = { primary: c.onPrimary, secondary: c.primary, sos: '#FFFFFF', ghost: c.primary, danger: c.sos, neutral: c.text }[kind];
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
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }, style]}
      />
    </View>
  );
}

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const c = useColors();
  const r = size * 0.28;
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: r }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.primary, fontFamily: fontFor(700), fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'sos' }) {
  const c = useColors();
  const fg = { neutral: c.muted, primary: c.primary, success: c.success, sos: c.sos }[tone];
  const bg = { neutral: c.surface, primary: c.primarySoft, success: '#E6F7EE', sos: c.sosSoft }[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontFamily: fontFor(700), letterSpacing: 0.3 }}>{label}</Text>
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
        borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : c.card,
      }}>
      <Text style={{ color: selected ? '#fff' : c.text, fontSize: 14, fontFamily: fontFor(600) }}>{label}</Text>
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
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md, shadowColor: '#170B2F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: 'Inter_400Regular' },
});

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Certifié">
      <Path fill={c.primary} d="M12 1.8l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3-1-3 2.6-1.9 1-3 3.2.1z" />
      <Path d="m8 12.2 2.8 2.8L16.2 9.6" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.6, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 8 }}>{title}</Text> : null}
      <View style={{ backgroundColor: c.card, borderRadius: 20, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export function Row({ label, value, tint, icon, onPress, last, right }: { label: string; value?: string; tint?: string; icon?: ReactNode; onPress?: () => void; last?: boolean; right?: ReactNode }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
      {icon ? <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: tint ?? c.primary, alignItems: 'center', justifyContent: 'center' }}>{icon}</View> : null}
      <Text style={{ flex: 1, color: c.text, fontSize: 17, fontFamily: fontFor(400) }}>{label}</Text>
      {value ? <Text style={{ color: c.muted, fontSize: 16 }}>{value}</Text> : null}
      {right ?? (onPress ? <Text style={{ color: c.muted, fontSize: 20 }}>›</Text> : null)}
    </Pressable>
  );
}
