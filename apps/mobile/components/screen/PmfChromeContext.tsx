import * as React from 'react';

import { usePmfSurface } from '@/components/screen/pmfChrome';
import type { ThemeSurface } from '@/constants/theme';

const PmfChromeContext = React.createContext<ThemeSurface | null>(null);

export function PmfChromeProvider({
  surface,
  children,
}: {
  surface?: ThemeSurface;
  children: React.ReactNode;
}) {
  const fallback = usePmfSurface();
  const value = surface ?? fallback;
  return <PmfChromeContext.Provider value={value}>{children}</PmfChromeContext.Provider>;
}

export function usePmfChrome(): ThemeSurface {
  const ctx = React.useContext(PmfChromeContext);
  const fallback = usePmfSurface();
  return ctx ?? fallback;
}
