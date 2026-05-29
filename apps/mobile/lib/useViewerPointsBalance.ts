/**
 * Demo-local shared total points balance for the signed-in viewer.
 * Seeds from the current profile wallet mock until the backend wallet ships.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

const STORAGE_KEY = 'shouldi:viewer-total-points-balance:v1';
const LEGACY_EXPLORE_STORAGE_KEY = 'shouldi:explore-viewer-points-balance:v1';

export const DEFAULT_VIEWER_TOTAL_POINTS_BALANCE = 2450;

function parseNonNegativeInt(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function useViewerPointsBalance() {
  const [balance, setBalanceState] = React.useState(DEFAULT_VIEWER_TOTAL_POINTS_BALANCE);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const storedTotal = parseNonNegativeInt(await AsyncStorage.getItem(STORAGE_KEY));
        if (storedTotal != null) {
          if (!cancelled) setBalanceState(storedTotal);
          return;
        }

        const legacyExploreEarned = parseNonNegativeInt(
          await AsyncStorage.getItem(LEGACY_EXPLORE_STORAGE_KEY),
        );
        const nextBalance = DEFAULT_VIEWER_TOTAL_POINTS_BALANCE + (legacyExploreEarned ?? 0);

        await AsyncStorage.setItem(STORAGE_KEY, String(nextBalance));
        if (legacyExploreEarned != null) {
          await AsyncStorage.removeItem(LEGACY_EXPLORE_STORAGE_KEY);
        }

        if (!cancelled) setBalanceState(nextBalance);
      } catch {
        if (!cancelled) setBalanceState(DEFAULT_VIEWER_TOTAL_POINTS_BALANCE);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const awardPoints = React.useCallback((delta: number) => {
    if (!(typeof delta === 'number' && Number.isFinite(delta) && delta > 0)) return;
    setBalanceState((prev) => {
      const next = prev + delta;
      void AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { balance, hydrated, awardPoints };
}
