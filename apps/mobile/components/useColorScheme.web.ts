import { useResolvedColorScheme } from '@/lib/appearance';

/** Web: respect persisted appearance once `AppearanceProvider` is mounted. */
export function useColorScheme(): 'light' | 'dark' {
  return useResolvedColorScheme();
}
