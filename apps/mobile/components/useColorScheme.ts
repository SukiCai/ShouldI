import { useResolvedColorScheme } from '@/lib/appearance';

/**
 * App-aware light/dark (Settings + OS “system”).
 * Must run under `AppearanceProvider` (see `app/_layout.tsx`).
 */
export function useColorScheme(): 'light' | 'dark' {
  return useResolvedColorScheme();
}
