import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const STORAGE_KEY = 'shouldi.appearance.preference';

export type AppearancePreference = 'system' | 'light' | 'dark';

type AppearanceContextValue = {
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => void;
  resolvedScheme: 'light' | 'dark';
  ready: boolean;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function resolveScheme(pref: AppearancePreference, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return system === 'light' ? 'light' : 'dark';
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const system = useRNColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        setPreferenceState(raw);
      }
      setReady(true);
    });
  }, []);

  const resolvedScheme = useMemo(
    () => resolveScheme(preference, system),
    [preference, system],
  );

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      resolvedScheme,
      ready,
    }),
    [preference, setPreference, resolvedScheme, ready],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used within AppearanceProvider');
  }
  return ctx;
}

/** Effective light/dark for UI — persisted “system” resolves from the OS. */
export function useResolvedColorScheme(): 'light' | 'dark' {
  return useAppearance().resolvedScheme;
}
