import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Loading } from '@/components/ui';
import { SplashAnimated, splashPlayed } from '@/screens/SplashAnimated';
import { useAuth } from '@/lib/auth';
import { introSeen, onboarded } from '@/lib/onboarding';

// Point d'entrée : animation d'ouverture → présentation (première fois) ou connexion → accueil.
export default function Entry() {
  const { session, loading } = useAuth();
  const [flags, setFlags] = useState<{ intro: boolean; done: boolean } | null>(null);
  const [splash, setSplash] = useState(!splashPlayed());
  useEffect(() => { Promise.all([introSeen(), onboarded()]).then(([intro, done]) => setFlags({ intro, done })); }, []);
  let target: React.ReactNode = <Loading />;
  if (!loading && flags) {
    target = session
      ? <Redirect href={flags.done ? '/(tabs)/communities' : '/ready'} />
      : <Redirect href={flags.intro ? { pathname: '/intro', params: { step: 'login' } } : '/intro'} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0316' }}>
      {splash ? null : target}
      {splash ? <SplashAnimated onDone={() => setSplash(false)} /> : null}
    </View>
  );
}
