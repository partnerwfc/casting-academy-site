import { useColorScheme } from 'react-native';

const light = {
  bg: '#FFFFFF', surface: '#F7F9FC', card: '#FFFFFF', text: '#0D1635', muted: '#6F788B', border: '#E6EAF1',
  primary: '#2457F5', primarySoft: '#EFF3FF', onPrimary: '#FFFFFF', success: '#18A95D', sos: '#ED3345', sosSoft: '#FFF0F1',
};
const dark: typeof light = {
  bg: '#0B1020', surface: '#0D1635', card: '#121B3A', text: '#F5F7FB', muted: '#9AA3B8', border: '#222C4D',
  primary: '#4A7BFF', primarySoft: '#14234F', onPrimary: '#FFFFFF', success: '#22C55E', sos: '#FF4D5E', sosSoft: '#2A1218',
};
export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

// Une seule écriture partout : Inter. Sur Android, le poids se choisit par le nom de la police,
// pas par fontWeight, d'où cette table.
export const fonts = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' } as const;
export function fontFor(weight: string | number | undefined): string {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : weight);
  return w >= 800 ? fonts[800] : w >= 700 ? fonts[700] : w >= 600 ? fonts[600] : w >= 500 ? fonts[500] : fonts[400];
}
