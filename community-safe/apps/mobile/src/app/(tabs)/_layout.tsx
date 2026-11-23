import { Tabs } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { AppTabBar } from '@/components/AppTabBar';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <AppTabBar
          state={props.state}
          navigation={{ navigate: (name) => (name === 'compose' ? router.push('/studio/new') : router.navigate(`/(tabs)/${name}` as never)) }}
        />
      )}>
      <Tabs.Screen name="communities" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="compose" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
