
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

const light = {
  bg: '#FFFFFF', surface: '#F7F8FC', card: '#FFFFFF', text: '#170B2F', muted: '#6B7385', border: '#E8E9F2',
  primary: '#6D28D9', primarySoft: '#F0EBFF', onPrimary: '#FFFFFF', success: '#24B36B', sos: '#E11D48', sosSoft: '#FFF1F3',
  brand: '#633BEE', cyan: '#16B8E8', sosFrom: '#FF4D6D', accent: '#6D28D9', accent2: '#6D28D9', fill: '#EEEFF5',
};
// Thème sombre de la maquette : noir pur, cartes quasi noires, dégradé rose → orange pour les actions.
const dark: typeof light = {
  bg: '#000000', surface: '#000000', card: '#0E0E10', text: '#FFFFFF', muted: '#A1A1AA', border: '#232329',
  primary: '#FF2D87', primarySoft: '#2A0C20', onPrimary: '#FFFFFF', success: '#4ADE80', sos: '#FF3355', sosSoft: '#2A0A12',
  brand: '#FA0973', cyan: '#16B8E8', sosFrom: '#FF4D6D', accent: '#FA0973', accent2: '#FC8E26', fill: '#1A1A1F',
};
export type Colors = typeof light;
export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | 'light' | 'dark';

let current: Scheme = 'light';
const KEY = 'smc-theme';
export const getScheme = (): Scheme => current;
export const isDark = () => current === 'dark';
const resolve = (pref: ThemePref): Scheme => (pref === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : pref);
export async function loadThemePref(): Promise<ThemePref> {
  const saved = await AsyncStorage.getItem(KEY);
  const pref: ThemePref = saved === 'light' || saved === 'dark' ? saved : 'system';
  current = resolve(pref);
  return pref;
}
export async function saveThemePref(pref: ThemePref): Promise<Scheme> {
  await AsyncStorage.setItem(KEY, pref);
  current = resolve(pref);
  return current;
}
export const refreshScheme = (pref: ThemePref): Scheme => (current = resolve(pref));

export function useColors(): Colors {
  return current === 'dark' ? dark : light;
}

// Couleur « claire » de la maquette → équivalent sombre (fonds, filets, textes). Identité en mode clair.
const DARK_MAP: Record<string, string> = {
  '#fff': '#0E0E10', '#FFFFFF': '#0E0E10', '#EEEFF5': '#1A1A1F', '#E9E6F3': '#232329', '#ECE9F6': '#232329', '#E4E0F2': '#232329',
  '#DDD3F7': '#4A1A3A', '#CFC4F2': '#4A1A3A', '#C9CCD8': '#3A3A44', '#F0EBFF': '#2A0C20', '#F4F0FF': '#1B0B18', '#F7F3FF': '#240A1C',
  '#FFE9EE': '#2A0A12', '#FFF1F4': '#2A0A12', '#FFE4E9': '#2A0A12', '#F8C3CF': '#6B1428', '#D7D8E2': '#33333B',
  '#170B2F': '#FFFFFF', '#6B7385': '#A1A1AA', '#B6B9C6': '#6B6B75', '#3B3F4E': '#D4D4D8', '#4B5263': '#C4C4CC', '#15803D': '#4ADE80',
  '#6D28D9': '#FF2D87', '#E11D48': '#FF3355', '#E3F6EC': '#0F2A1C', '#FEF3C7': '#2A220A', '#E3F6FD': '#0B2530',
};
export const tint = (hex: string): string => (current === 'dark' ? (DARK_MAP[hex] ?? hex) : hex);

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

// Une seule écriture partout : Inter. Sur Android, le poids se choisit par le nom de la police,
// pas par fontWeight, d'où cette table.
export const fonts = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' } as const;
export function fontFor(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : weight);
  return w >= 800 ? fonts[800] : w >= 700 ? fonts[700] : w >= 600 ? fonts[600] : w >= 500 ? fonts[500] : fonts[400];
}
