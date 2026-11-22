import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { TabIcon, type TabIconName } from '@/components/TabIcon';
import { useI18n } from '@/lib/i18n';
import { fontFor, useColors } from '@/lib/theme';

const icon = (name: TabIconName) => ({ focused, color }: { focused: boolean; color: string | import('react-native').ColorValue }) => <TabIcon name={name} active={focused} color={String(color)} size={24} />;

function AlertButton({ label }: { label: string }) {
  const router = useRouter();
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push('/studio')} style={{ flex: 1, alignItems: 'center', top: -14 }}>
      <View style={{ width: 52, height: 40, shadowColor: c.sos, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <Svg width={52} height={40} viewBox="0 0 52 40">
          <Defs><LinearGradient id="g" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.sosFrom} /><Stop offset="1" stopColor={c.sos} /></LinearGradient></Defs>
          <Rect width={52} height={40} rx={14} fill="url(#g)" />
          <Path d="M26 11v18M17 20h18" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" />
        </Svg>
      </View>
      <Text style={{ marginTop: 4, fontSize: 10, fontFamily: fontFor(700), color: c.text }}>{label}</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const c = useColors();
  const { t } = useI18n();
  const label = (key: 'tabs.communities' | 'tabs.discover' | 'tabs.alerts' | 'tabs.profile') => ({ focused, color }: { focused: boolean; color: string | import('react-native').ColorValue }) => (
    <Text numberOfLines={1} style={{ fontSize: 10, fontFamily: fontFor(focused ? 700 : 500), color: String(color) }}>{t(key)}</Text>
  );
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border, height: 68, paddingTop: 8 },
    }}>
      <Tabs.Screen name="communities" options={{ title: t('tabs.communities'), tabBarLabel: label('tabs.communities'), tabBarAccessibilityLabel: t('tabs.communities'), tabBarIcon: icon('users') }} />
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover'), tabBarLabel: label('tabs.discover'), tabBarAccessibilityLabel: t('tabs.discover'), tabBarIcon: icon('search') }} />
      <Tabs.Screen name="compose" options={{ title: t('tabs.alert'), tabBarButton: () => <AlertButton label={t('tabs.alert')} /> }} />
      <Tabs.Screen name="alerts" options={{ title: t('tabs.alerts'), tabBarLabel: label('tabs.alerts'), tabBarAccessibilityLabel: t('tabs.alerts'), tabBarIcon: icon('bell') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarLabel: label('tabs.profile'), tabBarAccessibilityLabel: t('tabs.profile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
