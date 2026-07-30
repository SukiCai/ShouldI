import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { Screen } from '@/components/ui';
import { GlassCard } from '@/components/ui/Premium';
import { resolveAppChromatics } from '@/constants/appChromatics';
import {
  council,
  elevation,
  PROFILE_HERO_GRADIENT_DARK,
  PROFILE_HERO_GRADIENT_LIGHT,
  radius,
  screenContentGutter,
  semantic,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';
import { useViewerEntitlements } from '@/lib/useViewerEntitlements';

type PointPack = {
  id: string;
  points: number;
  price: string;
  subtitle: string;
};

const POINT_PACKS: PointPack[] = [
  { id: 'session', points: 120, price: '$2.99', subtitle: '1 Expert Council session' },
  { id: 'bundle', points: 600, price: '$9.99', subtitle: '5 sessions · best value' },
  { id: 'plus', points: 1500, price: '$19.99', subtitle: '12+ sessions' },
];

function WalletSection({
  title,
  children,
  surface,
}: {
  title: string;
  children: React.ReactNode;
  surface: ReturnType<typeof themeSurface>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionEyebrow, { color: surface.textMuted }]}>{title}</Text>
      <GlassCard style={[styles.groupCard, elevation.rest]}>{children}</GlassCard>
    </View>
  );
}

function PackRow({
  pack,
  surface,
  isLast,
  onBuy,
}: {
  pack: PointPack;
  surface: ReturnType<typeof themeSurface>;
  isLast: boolean;
  onBuy: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buy ${pack.points} points for ${pack.price}`}
      onPress={onBuy}
      style={({ pressed }) => [
        styles.packRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surface.hairline },
        pressed && { backgroundColor: surface.pressedOverlay },
      ]}>
      <View style={[styles.packIcon, { backgroundColor: `${council.violet}14` }]}>
        <Ionicons name="diamond-outline" size={18} color={council.violet} />
      </View>
      <View style={styles.packCopy}>
        <Text style={[typography.compact, { color: surface.textPrimary, fontWeight: '700' }]}>
          {pack.points.toLocaleString()} pts
        </Text>
        <Text style={[typography.caption, { color: surface.textMuted, marginTop: 2 }]}>{pack.subtitle}</Text>
      </View>
      <View style={[styles.packPricePill, { borderColor: surface.hairline, backgroundColor: surface.groupedSurface }]}>
        <Text style={[typography.caption, { color: council.violet, fontWeight: '800' }]}>{pack.price}</Text>
      </View>
    </Pressable>
  );
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const surface = themeSurface(scheme);
  const chrom = resolveAppChromatics(isDark, surface);

  const {
    balance,
    hydrated,
    isPremium,
    councilSessionCost,
    awardPoints,
    activatePremium,
    grantDevPoints,
    resetPointsBalance,
  } = useViewerEntitlements();

  const topPad = Math.max(insets.top, 12);

  const hapticLight = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  const buyPack = (pack: PointPack) => {
    hapticLight();
    Alert.alert(
      'Simulated purchase',
      `Add ${pack.points.toLocaleString()} points for ${pack.price}? (Preview — no charge.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            awardPoints(pack.points);
            Alert.alert('Points added', `${pack.points.toLocaleString()} pts are in your wallet.`);
          },
        },
      ],
    );
  };

  const subscribePremium = () => {
    hapticLight();
    if (isPremium) {
      Alert.alert('Premium active', 'Unlimited Expert Council sessions are included with your membership.');
      return;
    }
    Alert.alert(
      'Subscribe to Premium',
      'Unlimited Expert Council, continuity features, and compounding insights. (Preview — no charge.)',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: () => {
            void activatePremium().then(() => {
              Alert.alert('Welcome to Premium', 'Expert Council is now unlimited.');
            });
          },
        },
      ],
    );
  };

  return (
    <Screen variant="plain" padded={false} scroll>
      <View style={[styles.headerBar, { borderBottomColor: surface.hairline }]}>
        <LinearGradient
          colors={isDark ? [...PROFILE_HERO_GRADIENT_DARK] : [...PROFILE_HERO_GRADIENT_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.headerRow, { paddingTop: topPad + 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              {
                borderColor: surface.hairline,
                backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.9)',
              },
              pressed && { opacity: 0.88 },
            ]}>
            <Ionicons name="chevron-back" size={18} color={chrom.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: chrom.display }]} numberOfLines={1}>
            Wallet
          </Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 36) }]}>
        <GlassCard style={[styles.balanceCard, elevation.rest]}>
          <LinearGradient
            colors={isDark ? ['#1e1040', '#312e81'] : ['#f5f3ff', '#ede9fe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.balanceInner}>
            <Text style={[styles.balanceEyebrow, { color: council.gold }]}>YOUR BALANCE</Text>
            <Text style={[styles.balanceValue, { color: chrom.display }]}>
              {hydrated ? balance.toLocaleString() : '—'}
            </Text>
            <Text style={[styles.balanceUnit, { color: surface.textMuted }]}>points</Text>
            <Text style={[styles.balanceHint, { color: surface.textMuted }]}>
              Expert Council costs {councilSessionCost} pts per session
              {isPremium ? ' · Premium covers sessions' : ''}
            </Text>
          </View>
        </GlassCard>

        <WalletSection title="Membership" surface={surface}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPremium ? 'Premium membership active' : 'Subscribe to Premium'}
            onPress={subscribePremium}
            style={({ pressed }) => [styles.membershipRow, pressed && { backgroundColor: surface.pressedOverlay }]}>
            <View style={[styles.packIcon, { backgroundColor: `${council.gold}22` }]}>
              <Ionicons name="star" size={18} color={council.gold} />
            </View>
            <View style={styles.packCopy}>
              <Text style={[typography.compact, { color: surface.textPrimary, fontWeight: '700' }]}>
                {isPremium ? 'Premium active' : 'Premium membership'}
              </Text>
              <Text style={[typography.caption, { color: surface.textMuted, marginTop: 2 }]}>
                {isPremium
                  ? 'Unlimited Expert Council sessions'
                  : 'Unlimited Council + continuity features'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={surface.textMuted} />
          </Pressable>
        </WalletSection>

        <WalletSection title="Buy points" surface={surface}>
          {POINT_PACKS.map((pack, index) => (
            <PackRow
              key={pack.id}
              pack={pack}
              surface={surface}
              isLast={index === POINT_PACKS.length - 1}
              onBuy={() => buyPack(pack)}
            />
          ))}
        </WalletSection>

        <WalletSection title="Earn points" surface={surface}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Earn points in Explore"
            onPress={() => {
              hapticLight();
              router.push('/(tabs)/explore');
            }}
            style={({ pressed }) => [
              styles.membershipRow,
              pressed && { backgroundColor: surface.pressedOverlay },
            ]}>
            <View style={[styles.packIcon, { backgroundColor: `${semantic.actionAffirm}18` }]}>
              <Ionicons name="compass-outline" size={18} color={semantic.actionAffirm} />
            </View>
            <View style={styles.packCopy}>
              <Text style={[typography.compact, { color: surface.textPrimary, fontWeight: '700' }]}>
                Explore & engage
              </Text>
              <Text style={[typography.caption, { color: surface.textMuted, marginTop: 2 }]}>
                Earn points by reading, voting, and sharing perspectives
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={surface.textMuted} />
          </Pressable>
        </WalletSection>

        {__DEV__ ? (
          <WalletSection title="Developer" surface={surface}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Grant dev test points"
              onPress={() => {
                grantDevPoints();
                Alert.alert('Dev wallet', '+1,000 pts added.');
              }}
              style={({ pressed }) => [
                styles.devRow,
                { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surface.hairline },
                pressed && { backgroundColor: surface.pressedOverlay },
              ]}>
              <Text style={[typography.compact, { color: council.violet, fontWeight: '600' }]}>
                +1,000 pts (dev)
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset points balance"
              onPress={() => {
                resetPointsBalance();
                Alert.alert('Dev wallet', 'Points reset to 2,450.');
              }}
              style={({ pressed }) => [styles.devRow, pressed && { backgroundColor: surface.pressedOverlay }]}>
              <Text style={[typography.compact, { color: surface.textMuted, fontWeight: '600' }]}>
                Reset to 2,450 pts
              </Text>
            </Pressable>
          </WalletSection>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenContentGutter,
    paddingBottom: 10,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.titleSm,
    letterSpacing: -0.3,
  },
  headerSide: {
    width: 36,
  },
  content: {
    paddingHorizontal: screenContentGutter,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionEyebrow: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  groupCard: {
    overflow: 'hidden',
  },
  balanceCard: {
    overflow: 'hidden',
    minHeight: 132,
  },
  balanceInner: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 2,
    alignItems: 'center',
  },
  balanceEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 44,
    marginTop: 4,
  },
  balanceUnit: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  balanceHint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
    maxWidth: 280,
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  packIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCopy: {
    flex: 1,
    minWidth: 0,
  },
  packPricePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  devRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});
