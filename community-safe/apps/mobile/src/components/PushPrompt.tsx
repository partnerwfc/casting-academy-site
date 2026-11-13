import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { getPushState, syncDevice, type PushState } from '@/lib/push';
import { Button, Card, T } from './ui';

// Invitation à activer les notifications, affichée seulement quand elle est utile.
// Jamais de demande système sans un appui explicite de l'utilisateur.
export function PushPrompt({ showEnabled = false }: { showEnabled?: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPushState().then(setState); }, []);

  if (!state) return null;
  if (state === 'granted') return showEnabled ? <T v="small">✓ {t('push.enabled')}</T> : null;
  if (state === 'unsupported') return showEnabled ? <T v="small">{t('push.unsupported')}</T> : null;
  if (state === 'denied') {
    return (
      <Card tone="soft">
        <T v="muted">{t('push.denied')}</T>
        <Button label={t('push.openSettings')} kind="secondary" onPress={() => Linking.openSettings()} />
      </Card>
    );
  }
  return (
    <Card tone="soft">
      <T v="heading">{t('push.title')}</T>
      <T v="muted">{t('push.body')}</T>
      <Button label={t('push.enable')} loading={busy} onPress={async () => { setBusy(true); setState(await syncDevice(true)); setBusy(false); }} />
    </Card>
  );
}
