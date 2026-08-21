import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import JumpUpSheet from '@/components/ui/JumpUpSheet';
import { council } from '@/constants/theme';
import type { CouncilUnlockMethod } from '@/lib/useViewerEntitlements';

type CouncilPaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
  bottomInset: number;
  grabColor: string;
  isDark: boolean;
  primaryTxt: string;
  muted: string;
  entitlementsHydrated: boolean;
  pointsBalance: number;
  councilSessionCost: number;
  canUseCouncilWithPoints: boolean;
  onActivateCouncilMode: (unlock: CouncilUnlockMethod) => void;
  grantDevPoints: () => void;
  activatePremium: () => Promise<void>;
};

export function CouncilPaywallSheet({
  visible,
  onClose,
  bottomInset,
  grabColor,
  isDark,
  primaryTxt,
  muted,
  entitlementsHydrated,
  pointsBalance,
  councilSessionCost,
  canUseCouncilWithPoints,
  onActivateCouncilMode,
  grantDevPoints,
  activatePremium,
}: CouncilPaywallSheetProps) {
  return (
    <JumpUpSheet
      visible={visible}
      onClose={onClose}
      backgroundColor="transparent"
      borderTopColor={`${council.violet}44`}
      bottomInset={bottomInset}
      maxHeight="88%"
      grabColor={grabColor}
      cardStyle={styles.paywallSheetCard}>
      <LinearGradient
        colors={isDark ? ['#1e1040', '#312e81', '#0f172a'] : ['#f5f3ff', '#ede9fe', '#e0f2fe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.paywallSheetInner}>
        <View style={[styles.paywallIconWrap, { backgroundColor: `${council.violet}22` }]}>
          <Ionicons name="people-circle" size={32} color={council.violet} />
        </View>
        <Text style={[styles.paywallKicker, { color: council.gold }]}>EXPERT MODE</Text>
        <Text style={[styles.paywallTitle, { color: primaryTxt }]}>Expert Council</Text>
        <Text style={[styles.paywallBody, { color: muted }]}>
          Multiple specialists review your decision. You get a recommendation, key tradeoffs, and each expert vote.
        </Text>
        <View style={styles.paywallFeatureList}>
          {[
            { icon: 'people' as const, text: 'Multiple expert perspectives' },
            { icon: 'git-compare' as const, text: 'Individual yes / no votes' },
            { icon: 'shield-checkmark' as const, text: 'Risks surfaced per expert' },
          ].map((feat) => (
            <View key={feat.text} style={styles.paywallFeatureRow}>
              <View style={styles.paywallFeatureIcon}>
                <Ionicons name={feat.icon} size={15} color={council.violet} />
              </View>
              <Text style={[styles.paywallFeatureText, { color: primaryTxt }]}>{feat.text}</Text>
            </View>
          ))}
        </View>
        {entitlementsHydrated ? (
          <Text style={[styles.paywallBalance, { color: muted }]}>
            Your balance: {pointsBalance.toLocaleString()} pts
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get Premium subscription"
          onPress={() => {
            onClose();
            router.push('/wallet');
          }}
          style={styles.paywallPrimaryWrap}>
          <LinearGradient
            colors={isDark ? ['#7c3aed', '#6d28d9', '#4c1d95'] : ['#a78bfa', '#8b5cf6', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.paywallPrimary}>
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={[styles.paywallPrimaryText, { color: '#fff' }]} numberOfLines={1}>
              Get Premium
            </Text>
            <Text style={[styles.paywallPrimarySub, { color: 'rgba(255,255,255,0.88)' }]}>unlimited sessions</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buy points"
          onPress={() => {
            onClose();
            router.push('/wallet');
          }}
          style={[
            styles.paywallSecondary,
            {
              borderColor: `${council.gold}55`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
            },
          ]}>
          <Ionicons name="wallet-outline" size={16} color={council.gold} />
          <Text style={[styles.paywallSecondaryText, { color: primaryTxt }]} numberOfLines={1}>
            Buy points
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use ${councilSessionCost} points for this council session`}
          disabled={!canUseCouncilWithPoints}
          onPress={() => onActivateCouncilMode('points')}
          style={[
            styles.paywallSecondary,
            {
              borderColor: `${council.violet}44`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
              opacity: canUseCouncilWithPoints ? 1 : 0.45,
            },
          ]}>
          <Ionicons name="diamond-outline" size={16} color={council.violet} />
          <Text style={[styles.paywallSecondaryText, { color: primaryTxt }]} numberOfLines={1}>
            Use {councilSessionCost} points
          </Text>
          <Text style={[styles.paywallSecondarySub, { color: muted }]}>this session</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={onClose}
          style={styles.paywallDismiss}>
          <Text style={[styles.paywallDismissText, { color: muted }]}>Not now</Text>
        </Pressable>
        {__DEV__ ? (
          <View style={styles.paywallDevRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add 1000 dev test points"
              onPress={() => {
                grantDevPoints();
                onClose();
              }}
              style={[styles.paywallDevBtn, { borderColor: `${council.violet}44` }]}>
              <Text style={[styles.paywallDevBtnText, { color: council.violet }]}>+1,000 pts (dev)</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Activate Premium for dev testing"
              onPress={() => {
                void activatePremium();
                onClose();
              }}
              style={[styles.paywallDevBtn, { borderColor: `${council.gold}66` }]}>
              <Text style={[styles.paywallDevBtnText, { color: council.gold }]}>Premium (dev)</Text>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>
    </JumpUpSheet>
  );
}

const styles = StyleSheet.create({
  paywallSheetCard: {
    overflow: 'hidden',
  },
  paywallSheetInner: {
    paddingHorizontal: 22,
    paddingBottom: 8,
    gap: 12,
    alignItems: 'stretch',
  },
  paywallKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    alignSelf: 'center',
  },
  paywallIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    alignSelf: 'center',
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    alignSelf: 'center',
  },
  paywallBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 320,
  },
  paywallBalance: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    alignSelf: 'center',
  },
  paywallFeatureList: {
    width: '100%',
    gap: 10,
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  paywallFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  paywallFeatureIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paywallFeatureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  paywallPrimaryWrap: {
    width: '100%',
    marginTop: 4,
  },
  paywallPrimary: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  paywallPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  paywallPrimarySub: {
    fontSize: 13,
    fontWeight: '600',
  },
  paywallSecondary: {
    width: '100%',
    minHeight: 46,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
  },
  paywallSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  paywallSecondarySub: {
    fontSize: 13,
    fontWeight: '500',
  },
  paywallDismiss: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  paywallDismissText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paywallDevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingBottom: 8,
  },
  paywallDevBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  paywallDevBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
