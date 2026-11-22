import { useColorScheme } from 'react-native';

const light = {
  bg: '#FFFFFF', surface: '#F7F8FC', card: '#FFFFFF', text: '#170B2F', muted: '#6B7385', border: '#E8E9F2',
  primary: '#6D28D9', primarySoft: '#F0EBFF', onPrimary: '#FFFFFF', success: '#24B36B', sos: '#E11D48', sosSoft: '#FFF1F3',
  brand: '#633BEE', cyan: '#16B8E8', sosFrom: '#FF4D6D',
};
const dark: typeof light = {
  bg: '#0F0720', surface: '#170B2F', card: '#1D1040', text: '#F5F3FF', muted: '#A59CC0', border: '#2B1D52',
  primary: '#8B5CF6', primarySoft: '#251650', onPrimary: '#FFFFFF', success: '#34D399', sos: '#FB3B66', sosSoft: '#2D1020',
  brand: '#7C5CFF', cyan: '#16B8E8', sosFrom: '#FF4D6D',
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
