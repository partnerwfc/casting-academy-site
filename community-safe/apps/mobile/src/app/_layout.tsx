import { DarkTheme, DefaultTheme, ThemeProvider, router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { AuthProvider } from '@/lib/auth';
import { LocaleProvider, useI18n } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

// Un appui sur une notification ouvre le détail de l'alerte — jamais le lien externe directement.
function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const alertId = response?.notification.request.content.data?.alertId;
    if (typeof alertId === 'string' && response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push(`/alert/${alertId}`);
    }
  }, [response]);
}

function Navigator() {
  const c = useColors();
  const { t } = useI18n();
  useNotificationRouting();
  return (
    <Stack screenOptions={{ headerTintColor: c.primary, headerTitleStyle: { color: c.text }, headerStyle: { backgroundColor: c.bg }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: t('auth.title'), presentation: 'modal' }} />
      <Stack.Screen name="creator/[handle]" options={{ title: '' }} />
      <Stack.Screen name="alert/[id]" options={{ title: '' }} />
      <Stack.Screen name="studio/index" options={{ title: t('dash.title') }} />
      <Stack.Screen name="studio/setup" options={{ title: t('setup.title') }} />
      <Stack.Screen name="studio/verify" options={{ title: t('verify.title') }} />
      <Stack.Screen name="studio/compose" options={{ title: '' }} />
      <Stack.Screen name="studio/transfer" options={{ title: t('kit.title') }} />
      <Stack.Screen name="studio/alert/[id]" options={{ title: t('track.title') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LocaleProvider>
        <AuthProvider>
          <Navigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
