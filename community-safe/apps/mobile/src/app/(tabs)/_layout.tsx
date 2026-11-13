import { Tabs } from 'expo-router/js-tabs';
import { TabIcon, type TabIconName } from '@/components/TabIcon';
import { useI18n } from '@/lib/i18n';
import { fontFor, useColors } from '@/lib/theme';

const icon = (name: TabIconName) => ({ focused, color }: { focused: boolean; color: string | import('react-native').ColorValue }) => <TabIcon name={name} active={focused} color={String(color)} />;

export default function TabsLayout() {
  const c = useColors();
  const { t } = useI18n();
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.text,
      tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border },
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover'), tabBarAccessibilityLabel: t('tabs.discover'), tabBarIcon: icon('search') }} />
      <Tabs.Screen name="communities" options={{ title: t('tabs.communities'), tabBarAccessibilityLabel: t('tabs.communities'), tabBarIcon: icon('users') }} />
      <Tabs.Screen name="alerts" options={{ title: t('tabs.alerts'), tabBarAccessibilityLabel: t('tabs.alerts'), tabBarIcon: icon('bell') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarAccessibilityLabel: t('tabs.profile'), tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
