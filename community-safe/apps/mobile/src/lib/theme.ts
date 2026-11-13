import { useColorScheme } from 'react-native';

const light = {
  bg: '#FFFFFF', surface: '#F5F7FB', card: '#FFFFFF', text: '#0D1635', muted: '#70788B', border: '#E9ECF0',
  primary: '#0755FF', primarySoft: '#EEF3FF', onPrimary: '#FFFFFF', success: '#16A34A', sos: '#F52235', sosSoft: '#FFF0F1',
};
const dark: typeof light = {
  bg: '#0B1020', surface: '#0D1635', card: '#121B3A', text: '#F5F7FB', muted: '#9AA3B8', border: '#222C4D',
  primary: '#3D7BFF', primarySoft: '#14234F', onPrimary: '#FFFFFF', success: '#22C55E', sos: '#FF4D5E', sosSoft: '#2A1218',
};
export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
