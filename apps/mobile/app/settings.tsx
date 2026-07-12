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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { GlassCard } from '@/components/ui/Premium';
import { ListRow, Screen } from '@/components/ui';
import { resolveAppChromatics } from '@/constants/appChromatics';
import {
  elevation,
  palette,
  PROFILE_HERO_GRADIENT_DARK,
  PROFILE_HERO_GRADIENT_LIGHT,
  profileLight,
  radius,
  screenContentGutter,
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
  return (
    <View style={styles.appearanceRow}>
      {APPEARANCE_OPTIONS.map((opt) => {
        const active = preference === opt.key;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label} appearance`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(opt.key)}
            style={({ pressed }) => [
              styles.appearancePill,
              {
                borderColor: active ? chrom.mint : surface.hairline,
                backgroundColor: active
                  ? isDark
                    ? `${chrom.mint}18`
                    : `${profileLight.mint}14`
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : palette.sheet,
              },
              pressed && !active && { opacity: 0.88 },
            ]}>
            <Ionicons
              name={opt.icon}
              size={18}
              color={active ? chrom.mint : surface.textMuted}
            />
            <Text
              style={[
                styles.appearanceLabel,
                { color: active ? chrom.textPrimary : surface.textMuted, fontWeight: active ? '700' : '600' },
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const surface = themeSurface(scheme);
  const chrom = resolveAppChromatics(isDark, surface);
  const switchThumbOff = isDark ? '#585f68' : palette.sheet;
  const switchTrackOn = isDark ? `${palette.neonMint}55` : `${profileLight.mint}66`;
  const switchThumbOn = isDark ? palette.neonMint : profileLight.mint;

  const { preference, setPreference } = useAppearance();
  const { resetPointsBalance } = useViewerEntitlements();

  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [emailDigest, setEmailDigest] = React.useState(false);
  const [mentionAlerts, setMentionAlerts] = React.useState(true);

  const topPad = Math.max(insets.top, 12);

  const setAppearance = (next: AppearancePreference) => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
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
  appearanceRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  appearancePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  appearanceLabel: {
    fontSize: 12,
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
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  footerMeta: {
    ...typography.caption,
    fontWeight: '500',
  },
});
