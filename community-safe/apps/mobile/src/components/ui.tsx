import type { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFor, radius, space, useColors } from '@/lib/theme';

export interface NavSpec { close?: boolean; back?: string | false; title?: string; right?: { label: string; onPress: () => void }; onBack?: () => void }

// Barre de navigation des maquettes : « ‹ Retour » à gauche, titre centré, action à droite.
export function NavBar({ nav }: { nav: NavSpec }) {
  const c = useColors();
  const back = nav.onBack ?? (() => router.back());
  return (
    <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        {nav.close ? <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={back} hitSlop={12}><Text style={{ color: c.text, fontSize: 24 }}>✕</Text></Pressable> : nav.back === false ? null : (
          <Pressable accessibilityRole="button" onPress={back} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 26, marginTop: -3 }}>‹</Text>
            <Text style={{ color: c.text, fontSize: 17, fontFamily: fontFor(400) }}>{nav.back ?? 'Retour'}</Text>
          </Pressable>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: c.text, fontSize: 17, fontFamily: fontFor(700) }}>{nav.title ?? ''}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {nav.right ? <Pressable accessibilityRole="button" onPress={nav.right.onPress} hitSlop={10}><Text style={{ color: c.text, fontSize: 17, fontFamily: fontFor(400) }}>{nav.right.label}</Text></Pressable> : null}
      </View>
    </View>
  );
}

export function Screen({ children, scroll = true, padded = true, bg, nav, footer }: { children: ReactNode; scroll?: boolean; padded?: boolean; bg?: string; nav?: NavSpec; footer?: ReactNode }) {
  const c = useColors();
  const pad = padded ? { padding: space.xl - 4, paddingTop: space.lg, gap: space.lg } : undefined;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg ?? c.surface }} edges={['top', 'left', 'right']}>
      {nav ? <NavBar nav={nav} /> : null}
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[pad, { paddingBottom: space.xxl }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
      {footer ? <View style={{ paddingHorizontal: space.xl - 4, paddingBottom: space.lg, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
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

const TINTS: [string, string][] = [['#F0EBFF', '#6D28D9'], ['#E3F6FD', '#0E7490']];
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 2);
  const w = words.length ? words : name.trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0]?.[0] ?? '?').toUpperCase();
}
export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const r = size * 0.28;
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: r }} accessibilityIgnoresInvertColors />;
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const [bg, fg] = TINTS[h % TINTS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontFamily: fontFor(800), fontSize: size * 0.34 }}>{initials(name)}</Text>
    </View>
  );
}

type PillTone = 'neutral' | 'primary' | 'success' | 'sos' | 'warn';
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const c = useColors();
  const map: Record<PillTone, [string, string]> = {
    neutral: ['#EEEFF5', '#6B7385'], primary: ['#F0EBFF', c.primary], success: ['#E3F6EC', '#15803D'], sos: ['#FFE4E9', c.sos], warn: ['#FEF3C7', '#92400E'],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 12, fontFamily: fontFor(700), letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, tone = 'violet', fill = false }: { label: string; selected: boolean; onPress: () => void; tone?: 'violet' | 'dark'; fill?: boolean }) {
  const c = useColors();
  const on = tone === 'dark' ? '#170B2F' : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 18, height: 40, justifyContent: 'center', borderRadius: radius.pill, borderWidth: selected || fill ? 0 : 1,
        borderColor: '#E9E6F3', backgroundColor: selected ? on : fill ? '#EEEFF5' : '#fff',
      }}>
      <Text style={{ color: selected ? '#fff' : c.text, fontSize: 15, fontFamily: fontFor(600) }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#EEEFF5', borderRadius: 14, padding: 3 }}>
      {options.map((o) => (
        <Pressable key={String(o.value)} accessibilityRole="button" accessibilityState={{ selected: value === o.value }} onPress={() => onChange(o.value)}
          style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: value === o.value ? '#fff' : 'transparent',
            shadowColor: '#170B2F', shadowOpacity: value === o.value ? 0.1 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: value === o.value ? 1 : 0 }}>
          <Text style={{ fontSize: 15, color: '#170B2F', fontFamily: fontFor(600) }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
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
      {title ? <Text style={{ color: c.muted, fontSize: 13, letterSpacing: 0.8, fontFamily: fontFor(700), textTransform: 'uppercase', marginLeft: 8 }}>{title}</Text> : null}
      <View style={{ backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export function Row({ label, value, tint, icon, onPress, last, right }: { label: string; value?: string; tint?: string; icon?: ReactNode; onPress?: () => void; last?: boolean; right?: ReactNode }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 58, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#EEEFF5' }}>
      {icon ? <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tint ?? c.primary, alignItems: 'center', justifyContent: 'center' }}>{icon}</View> : null}
      <Text style={{ flex: 1, color: c.text, fontSize: 17, fontFamily: fontFor(400) }}>{label}</Text>
      {value ? <Text style={{ color: c.muted, fontSize: 17 }}>{value}</Text> : null}
      {right ?? (onPress ? <Text style={{ color: '#B6B9C6', fontSize: 22 }}>›</Text> : null)}
    </Pressable>
  );
}
