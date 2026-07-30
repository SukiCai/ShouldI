import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { GlassCard } from '@/components/ui/Premium';
import { ListRow, Screen } from '@/components/ui';
import { MOTION, usePrefersReducedMotion } from '@/constants/motion';
import { resolveAppChromatics } from '@/constants/appChromatics';
import {
  elevation,
  palette,
  PROFILE_HERO_GRADIENT_DARK,
  PROFILE_HERO_GRADIENT_LIGHT,
  profileLight,
  radius,
  screenContentGutter,
  semantic,
  spacing,
  themeSurface,
  typography,
} from '@/constants/theme';
import type { AppearancePreference } from '@/lib/appearance';
import { useAppearance } from '@/lib/appearance';
import { useViewerEntitlements } from '@/lib/useViewerEntitlements';

type AppearanceOption = {
  key: AppearancePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { key: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

function SettingsSection({
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

function AppearancePicker({
  preference,
  onSelect,
  surface,
  chrom,
  isDark,
}: {
  preference: AppearancePreference;
  onSelect: (next: AppearancePreference) => void;
  surface: ReturnType<typeof themeSurface>;
  chrom: ReturnType<typeof resolveAppChromatics>;
  isDark: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const selectionPop = useSharedValue(1);

  const activeIndex = React.useMemo(
    () => Math.max(0, APPEARANCE_OPTIONS.findIndex((opt) => opt.key === preference)),
    [preference],
  );

  const moveIndicator = React.useCallback(
    (index: number, width: number, animated: boolean) => {
      if (width < 1) return;
      const gap = 8;
      const horizontalPad = 12;
      const inner = width - horizontalPad * 2;
      const seg = (inner - gap * (APPEARANCE_OPTIONS.length - 1)) / APPEARANCE_OPTIONS.length;
      const x = horizontalPad + index * (seg + gap);
      indicatorW.value = seg;
      if (animated && !reducedMotion) {
        indicatorX.value = withSpring(x, MOTION.tab);
        selectionPop.value = withSequence(
          withSpring(1.06, { damping: 18, stiffness: 420, mass: 0.34 }),
          withSpring(1, MOTION.tab),
        );
      } else {
        indicatorX.value = x;
        selectionPop.value = 1;
      }
    },
    [indicatorW, indicatorX, reducedMotion, selectionPop],
  );

  React.useEffect(() => {
    moveIndicator(activeIndex, trackWidth, true);
  }, [activeIndex, moveIndicator, trackWidth]);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setTrackWidth(width);
    moveIndicator(activeIndex, width, false);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorW.value,
    transform: [{ translateX: indicatorX.value }, { scale: selectionPop.value }],
  }));

  const inactiveBg = isDark ? 'rgba(255,255,255,0.04)' : palette.sheet;
  const indicatorColors = isDark
    ? ([`${chrom.mint}30`, `${chrom.sky}18`] as const)
    : ([`${profileLight.mint}24`, `${profileLight.sky}14`] as const);

  return (
    <View style={styles.appearanceTrack} onLayout={onTrackLayout}>
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.appearanceIndicator,
            { borderColor: `${chrom.mint}55` },
            indicatorStyle,
          ]}>
          <LinearGradient
            colors={indicatorColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      ) : null}

      {APPEARANCE_OPTIONS.map((opt) => {
        const active = preference === opt.key;
        return (
          <AppearancePill
            key={opt.key}
            label={opt.label}
            icon={opt.icon}
            active={active}
            chrom={chrom}
            surface={surface}
            inactiveBg={inactiveBg}
            reducedMotion={reducedMotion}
            onPress={() => {
              if (opt.key === preference) return;
              onSelect(opt.key);
            }}
          />
        );
      })}
    </View>
  );
}

function AppearancePill({
  label,
  icon,
  active,
  chrom,
  surface,
  inactiveBg,
  reducedMotion,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  chrom: ReturnType<typeof resolveAppChromatics>;
  surface: ReturnType<typeof themeSurface>;
  inactiveBg: string;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(1);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: active ? 1.04 : 1 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} appearance`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => {
        if (reducedMotion) return;
        press.value = withSpring(MOTION.press.scale, MOTION.tab);
      }}
      onPressOut={() => {
        if (reducedMotion) return;
        press.value = withSpring(1, MOTION.tab);
      }}
      style={styles.appearancePillHit}>
      <Animated.View
        style={[
          styles.appearancePill,
          shellStyle,
          { backgroundColor: active ? 'transparent' : inactiveBg },
        ]}>
        <Animated.View style={iconStyle}>
          <Ionicons name={icon} size={18} color={active ? chrom.mint : surface.textMuted} />
        </Animated.View>
        <Text
          style={[
            styles.appearanceLabel,
            {
              color: active ? chrom.textPrimary : surface.textMuted,
              fontWeight: active ? '700' : '600',
            },
          ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const surface = themeSurface(scheme);
  const chrom = resolveAppChromatics(isDark, surface);
  const switchThumbOff = isDark ? '#585f68' : palette.sheet;
  const switchTrackOn = isDark ? `${semantic.actionAffirm}55` : `${semantic.actionAffirm}44`;
  const switchThumbOn = semantic.actionAffirm;

  const { preference, setPreference } = useAppearance();
  const { balance, isPremium, resetPointsBalance } = useViewerEntitlements();

  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [emailDigest, setEmailDigest] = React.useState(false);
  const [mentionAlerts, setMentionAlerts] = React.useState(true);

  const topPad = Math.max(insets.top, 12);

  const setAppearance = (next: AppearancePreference) => {
    if (next === preference) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    setPreference(next);
  };

  const toggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (value: boolean) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    setter(value);
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
            accessibilityLabel="Back to profile"
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
            Settings
          </Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 36) }]}>
        <SettingsSection title="Appearance" surface={surface}>
          <AppearancePicker
            preference={preference}
            onSelect={setAppearance}
            surface={surface}
            chrom={chrom}
            isDark={isDark}
          />
        </SettingsSection>

        <SettingsSection title="Account" surface={surface}>
          <ListRow
            icon="wallet-outline"
            title="Wallet & membership"
            subtitle={
              isPremium
                ? `Premium · ${balance.toLocaleString()} pts`
                : `${balance.toLocaleString()} points`
            }
            onPress={() => router.push('/wallet')}
            showChevron
            isLast={false}
          />
          <ListRow
            icon="log-in-outline"
            title="Sign in"
            subtitle="Existing account"
            onPress={() => router.push('/sign-in')}
            showChevron
            isLast={false}
          />
          <ListRow
            icon="person-add-outline"
            title="Join"
            subtitle="Create your profile"
            onPress={() => router.push('/sign-up')}
            showChevron
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Notifications" surface={surface}>
          <ListRow icon="notifications-outline" title="Push notifications" subtitle="Votes, replies, outcomes" isLast={false}>
            <Switch
              accessibilityLabel="Push notifications"
              value={pushEnabled}
              onValueChange={toggleSwitch(setPushEnabled)}
              trackColor={{ false: surface.hairline, true: switchTrackOn }}
              thumbColor={pushEnabled ? switchThumbOn : switchThumbOff}
            />
          </ListRow>
          <ListRow icon="mail-outline" title="Weekly digest" subtitle="Highlights from your circles" isLast={false}>
            <Switch
              accessibilityLabel="Weekly digest email"
              value={emailDigest}
              onValueChange={toggleSwitch(setEmailDigest)}
              trackColor={{ false: surface.hairline, true: switchTrackOn }}
              thumbColor={emailDigest ? switchThumbOn : switchThumbOff}
            />
          </ListRow>
          <ListRow icon="at" title="Mentions & tags" subtitle="When someone references you" isLast>
            <Switch
              accessibilityLabel="Mention alerts"
              value={mentionAlerts}
              onValueChange={toggleSwitch(setMentionAlerts)}
              trackColor={{ false: surface.hairline, true: switchTrackOn }}
              thumbColor={mentionAlerts ? switchThumbOn : switchThumbOff}
            />
          </ListRow>
        </SettingsSection>

        <SettingsSection title="Privacy & data" surface={surface}>
          <ListRow
            icon="lock-closed-outline"
            title="Privacy center"
            subtitle="Visibility, blocked accounts, data"
            onPress={() =>
              Alert.alert('Privacy center', 'Export, clear cache, and audience controls will live here.')
            }
            showChevron
            isLast={false}
          />
          <ListRow
            icon="eye-outline"
            title="Ad & personalization"
            subtitle="Tune recommendations"
            onPress={() => Alert.alert('Personalization', 'Fine-grained ad and recommendation controls ship with v1.')}
            showChevron
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Support" surface={surface}>
          <ListRow
            icon="help-circle-outline"
            title="Help & FAQ"
            onPress={() => Alert.alert('Help', 'Support and guides will open in-browser shortly.')}
            showChevron
            isLast={false}
          />
          <ListRow
            icon="chatbubble-outline"
            title="Send feedback"
            onPress={() => Alert.alert('Feedback', 'Thanks — we read every note.')}
            showChevron
            isLast={false}
          />
          <ListRow
            icon="information-circle-outline"
            title="About ShouldI"
            subtitle="Version 1.0 · Terms & licenses"
            onPress={() =>
              Alert.alert('ShouldI', 'Decision intelligence for real life. This build is a preview.')
            }
            showChevron
            isLast
          />
        </SettingsSection>

        {__DEV__ ? (
          <SettingsSection title="Developer" surface={surface}>
            <ListRow
              icon="refresh-outline"
              title="Reset points"
              subtitle="Dev wallet to 2,450 pts"
              onPress={() => {
                resetPointsBalance();
                Alert.alert('Dev wallet', 'Points reset to 2,450.');
              }}
              isLast={false}
            />
            <ListRow
              icon="construct-outline"
              title="Diagnostics"
              subtitle="UI primitives & API health"
              onPress={() => router.push('/modal')}
              showChevron
              isLast
            />
          </SettingsSection>
        ) : null}

        <View style={[styles.footer, { borderTopColor: surface.hairline }]}>
          <Text style={[styles.footerBrand, { color: chrom.display }]}>ShouldI</Text>
          <Text style={[styles.footerMeta, { color: surface.textMuted }]}>Preview build · v1.0</Text>
        </View>
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
    marginLeft: 2,
  },
  groupCard: {
    padding: 0,
    paddingVertical: 2,
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  appearanceTrack: {
    position: 'relative',
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    minHeight: 72,
  },
  appearanceIndicator: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: profileLight.mint,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  appearancePillHit: {
    flex: 1,
    zIndex: 1,
  },
  appearancePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    minHeight: 48,
  },
  appearanceLabel: {
    ...typography.caption,
    letterSpacing: -0.1,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  footerBrand: {
    ...typography.subhead,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  footerMeta: {
    ...typography.caption,
    fontWeight: '500',
  },
});
