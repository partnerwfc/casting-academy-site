import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fontFor } from '@/lib/theme';
import { useUnreadCount } from '@/lib/unread';
import { TabIcon } from './TabIcon';

const ACTIVE = '#6D28D9', IDLE = '#6B7385';
type Key = 'communities' | 'discover' | 'compose' | 'alerts' | 'profile';

function PlusButton() {
  return (
    <View style={{ width: 48, height: 36, shadowColor: '#E11D48', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 }}>
      <Svg width={48} height={36} viewBox="0 0 48 36">
        <Defs><LinearGradient id="pb" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FF4D6D" /><Stop offset="0.6" stopColor="#E11D48" /><Stop offset="1" stopColor="#7C3AED" /></LinearGradient></Defs>
        <Rect width={48} height={36} rx={13} fill="url(#pb)" />
        <Path d="M24 10v16M16 18h16" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// Barre d'onglets de la maquette : icône + texte, onglet actif en violet, bouton « Alerte » central, avatar sur « Profil ».
export function TabBarView({ active, onPress, unread, initial }: { active: Key; onPress: (k: Key) => void; unread: number; initial: string }) {
  const { t } = useI18n();
  const item = (k: Exclude<Key, 'compose'>, label: string, icon: 'users' | 'search' | 'bell' | 'user') => {
    const on = active === k;
    const color = on ? ACTIVE : IDLE;
    return (
      <Pressable key={k} accessibilityRole="button" accessibilityLabel={label} onPress={() => onPress(k)} style={{ flex: 1, alignItems: 'center', paddingTop: 10, gap: 4 }}>
        <View>
          {k === 'profile' ? (
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center', borderWidth: on ? 2 : 0, borderColor: ACTIVE }}>
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: fontFor(700) }}>{initial}</Text>
            </View>
          ) : <TabIcon name={icon} active={on} color={color} size={26} />}
          {k === 'alerts' && unread > 0 ? <View style={{ position: 'absolute', top: -1, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#F43F5E', borderWidth: 1.5, borderColor: '#fff' }} /> : null}
        </View>
        <Text style={{ fontSize: 10.5, color, fontFamily: fontFor(on ? 700 : 500), width: 80, textAlign: 'center' }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EEEFF5', height: 72, paddingBottom: 6 }}>
      {item('communities', t('tabs.communities'), 'users')}
      {item('discover', t('tabs.discover'), 'search')}
      <Pressable accessibilityRole="button" accessibilityLabel={t('tabs.alert')} onPress={() => onPress('compose')} style={{ flex: 1, alignItems: 'center', top: -2, paddingTop: 8, gap: 5 }}>
        <PlusButton />
        <Text style={{ fontSize: 11, color: '#170B2F', fontFamily: fontFor(700) }}>{t('tabs.alert')}</Text>
      </Pressable>
      {item('alerts', t('tabs.alerts'), 'bell')}
      {item('profile', t('tabs.profile'), 'user')}
    </View>
  );
}

interface NavProps { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } }
export function AppTabBar({ state, navigation }: NavProps) {
  const { creator, session } = useAuth();
  const unread = useUnreadCount();
  const active = (state.routes[state.index]?.name ?? 'communities') as Key;
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const initial = (meta.full_name ?? meta.name ?? creator?.display_name ?? session?.user.email ?? '?').trim().charAt(0).toUpperCase();
  return <TabBarView active={active} unread={unread} initial={initial} onPress={(k) => navigation.navigate(k)} />;
}
