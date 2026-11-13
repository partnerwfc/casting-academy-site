import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'search' | 'users' | 'bell' | 'user' | 'card';

// Icônes de la barre d'onglets, façon Instagram : contour fin au repos, pleines (ou plus épaisses) quand actives.
export function TabIcon({ name, active, color, size = 27 }: { name: TabIconName; active: boolean; color: string; size?: number }) {
  const fill = active ? color : 'none';
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...common}>
      {name === 'home' ? <Path fill={fill} d="M3.2 10.4 12 3.2l8.8 7.2V19.6a1.4 1.4 0 0 1-1.4 1.4H15v-5.8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H4.6a1.4 1.4 0 0 1-1.4-1.4z" /> : null}
      {name === 'search' ? <><Circle cx="10.8" cy="10.8" r="6.8" strokeWidth={active ? 2.9 : 2} /><Path d="m20.4 20.4-4.8-4.8" strokeWidth={active ? 2.9 : 2} /></> : null}
      {name === 'users' ? <><Circle cx="9" cy="8.2" r="3.3" fill={fill} /><Path fill={fill} d="M2.8 20.2c0-3.5 2.8-6 6.2-6s6.2 2.5 6.2 6" /><Circle cx="17.2" cy="9" r="2.5" fill={fill} /><Path d="M16.6 14.4c2.5.3 4.6 2.4 4.6 5.4" /></> : null}
      {name === 'bell' ? <><Path fill={fill} d="M6 9.4a6 6 0 1 1 12 0c0 5.6 2.4 7 2.4 7H3.6S6 15 6 9.4z" /><Path d="M9.8 19.8a2.3 2.3 0 0 0 4.4 0" /></> : null}
      {name === 'user' ? <><Circle cx="12" cy="8" r="4.1" fill={fill} /><Path fill={fill} d="M4 20.6c0-4.1 3.6-6.6 8-6.6s8 2.5 8 6.6" /></> : null}
      {name === 'card' ? <><Rect x="2.6" y="5" width="18.8" height="14" rx="3.2" fill={fill} /><Path d="M2.6 10h18.8" stroke={active ? '#FFFFFF' : color} /></> : null}
    </Svg>
  );
}
