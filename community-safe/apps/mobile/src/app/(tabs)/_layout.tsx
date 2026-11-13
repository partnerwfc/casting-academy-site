import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { fontFor, useColors } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const c = useColors();
  const { t } = useI18n();
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border },
      tabBarLabelStyle: { fontFamily: fontFor(600), fontSize: 11 },
    }}>
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover'), tabBarIcon: icon('⌕') }} />
      <Tabs.Screen name="communities" options={{ title: t('tabs.communities'), tabBarIcon: icon('♡') }} />
      <Tabs.Screen name="alerts" options={{ title: t('tabs.alerts'), tabBarIcon: icon('◉') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
