import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { getScheme, loadThemePref, refreshScheme, saveThemePref, type Scheme, type ThemePref } from '@/lib/theme';

// Apparence : clair, sombre ou automatique. Le changement remonte tout l'arbre (key) pour que chaque écran relise la palette.
const Ctx = createContext<{ pref: ThemePref; scheme: Scheme; setPref: (p: ThemePref) => void }>({ pref: 'system', scheme: 'light', setPref: () => {} });
export const useThemePref = () => useContext(Ctx);

export function ThemeSwitch({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref | null>(null);
  const [scheme, setScheme] = useState<Scheme>(getScheme());
  useEffect(() => { loadThemePref().then((p) => { setPrefState(p); setScheme(getScheme()); }); }, []);
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => { if (pref === 'system') setScheme(refreshScheme('system')); });
    return () => sub.remove();
  }, [pref]);
  const setPref = useCallback((p: ThemePref) => { setPrefState(p); saveThemePref(p).then(setScheme); }, []);
  const value = useMemo(() => ({ pref: pref ?? 'system', scheme, setPref }), [pref, scheme, setPref]);
  if (pref === null) return null;
  return <Ctx.Provider value={value}><Fragment_ key={scheme}>{children}</Fragment_></Ctx.Provider>;
}
const Fragment_ = ({ children }: { children: ReactNode }) => <>{children}</>;
