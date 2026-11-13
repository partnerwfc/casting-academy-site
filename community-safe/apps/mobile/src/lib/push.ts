import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

// App au premier plan : on affiche quand même la bannière, une alerte SOS ne doit pas passer inaperçue.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

async function installationId(): Promise<string> {
  const key = 'cs-installation-id';
  let id = await SecureStore.getItemAsync(key);
  if (!id) {
    id = Crypto.randomUUID(); // aléatoire : ne permet pas d'identifier le matériel
    await SecureStore.setItemAsync(key, id);
  }
  return id;
}

// Deux canaux Android distincts : l'utilisateur peut régler SOS et annonces séparément.
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('sos', {
    name: 'SOS', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('announcements', {
    name: 'Announcements', importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPushState(): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

// Enregistre l'appareil et son jeton auprès du serveur. `ask` = afficher la demande système.
export async function syncDevice(ask: boolean): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  await ensureChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (ask && status === 'undetermined') status = (await Notifications.requestPermissionsAsync()).status;
  const permission: PushState = status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

  let token: string | null = null;
  if (permission === 'granted' && Device.isDevice) {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    try {
      token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    } catch (e) {
      console.warn('push token unavailable', e);
    }
  }
  const { error } = await supabase.rpc('register_device', {
    p_installation_id: await installationId(),
    p_platform: Platform.OS,
    p_permission: permission,
    p_token: token,
    p_app_version: Constants.expoConfig?.version ?? null,
    p_locale: Intl.DateTimeFormat().resolvedOptions().locale,
  });
  if (error) console.warn('register_device failed', error.message);
  return permission === 'granted' && !Device.isDevice ? 'unsupported' : permission;
}

export async function unregisterDevice() {
  if (Platform.OS === 'web') return;
  await supabase.rpc('unregister_device', { p_installation_id: await installationId() });
}
