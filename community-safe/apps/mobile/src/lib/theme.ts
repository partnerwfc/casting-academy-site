import { useColorScheme } from 'react-native';

const light = {
  bg: '#FFFFFF', surface: '#F9FAFB', card: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#E5E7EB',
  primary: '#2563EB', primarySoft: '#EFF6FF', onPrimary: '#FFFFFF', success: '#16A34A', sos: '#DC2626', sosSoft: '#FEF2F2',
};
const dark: typeof light = {
  bg: '#0B0F19', surface: '#111827', card: '#161D2D', text: '#F9FAFB', muted: '#9CA3AF', border: '#263043',
  primary: '#3B82F6', primarySoft: '#172554', onPrimary: '#FFFFFF', success: '#22C55E', sos: '#EF4444', sosSoft: '#2A1215',
};
export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
