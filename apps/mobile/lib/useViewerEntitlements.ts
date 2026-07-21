import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { useViewerPointsBalance } from '@/lib/useViewerPointsBalance';

/** Points debited per Expert Council session (premium subscribers skip this). */
export const COUNCIL_SESSION_POINTS_COST = 120;

const PREMIUM_STORAGE_KEY = 'shouldi:viewer-premium-active:v1';

export type CouncilUnlockMethod = 'premium' | 'points';

export function useViewerEntitlements() {
  const { balance, hydrated: pointsHydrated, awardPoints, spendPoints, grantDevPoints, resetPointsBalance } =
    useViewerPointsBalance();
  const [isPremium, setIsPremium] = React.useState(false);
  const [premiumHydrated, setPremiumHydrated] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
        if (!cancelled) setIsPremium(stored === '1');
      } catch {
        if (!cancelled) setIsPremium(false);
      } finally {
        if (!cancelled) setPremiumHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hydrated = pointsHydrated && premiumHydrated;

  const canUseCouncilFree = isPremium;
  const canUseCouncilWithPoints = balance >= COUNCIL_SESSION_POINTS_COST;
  const canAccessCouncil = canUseCouncilFree || canUseCouncilWithPoints;

  const unlockCouncilWithPoints = React.useCallback((): boolean => {
    if (isPremium) return true;
    return spendPoints(COUNCIL_SESSION_POINTS_COST);
  }, [isPremium, spendPoints]);

  const refundCouncilPoints = React.useCallback(() => {
    if (!isPremium) awardPoints(COUNCIL_SESSION_POINTS_COST);
  }, [awardPoints, isPremium]);

  const resolveCouncilUnlock = React.useCallback((): CouncilUnlockMethod | null => {
    if (isPremium) return 'premium';
    if (canUseCouncilWithPoints) return 'points';
    return null;
  }, [canUseCouncilWithPoints, isPremium]);

  const activatePremium = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, '1');
      setIsPremium(true);
    } catch {
      setIsPremium(false);
    }
  }, []);

  return {
    balance,
    hydrated,
    isPremium,
    canAccessCouncil,
    canUseCouncilFree,
    canUseCouncilWithPoints,
    councilSessionCost: COUNCIL_SESSION_POINTS_COST,
    unlockCouncilWithPoints,
    refundCouncilPoints,
    resolveCouncilUnlock,
    activatePremium,
    awardPoints,
    grantDevPoints,
    resetPointsBalance,
  };
}
