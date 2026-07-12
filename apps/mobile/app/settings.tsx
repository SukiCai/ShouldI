import * as Haptics from 'expo-haptics';
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
import { GlassCard, SectionHeader } from '@/components/ui/Premium';
import { ListRow, Screen } from '@/components/ui';
import { palette, spacing, themeSurface, typography } from '@/constants/theme';
import type { AppearancePreference } from '@/lib/appearance';
import { useAppearance } from '@/lib/appearance';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  /** Light thumb on OLED reads as glowing; dial down when switch is off. */
  const switchThumbOff = scheme === 'dark' ? '#585f68' : palette.sheet;
  const { preference, setPreference } = useAppearance();

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

  return (
    <Screen variant="plain" padded={false} scroll>
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.75 },
          ]}>
          <Text style={{ fontSize: 22, color: surface.textPrimary }}>‹</Text>
        </Pressable>
        <Text style={[typography.title, { color: surface.textPrimary, fontWeight: '700' }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom + 24, 40), paddingHorizontal: 20 }}>
        <Text style={[typography.caption, styles.groupLabel, { color: surface.textMuted }]}>Appearance</Text>
        <GlassCard style={styles.groupCard}>
          {(
            [
              { key: 'system' as const, label: 'System default', sub: 'Match this device', icon: 'ellipse-outline' as const },
              { key: 'light' as const, label: 'Light', sub: 'Bright surfaces', icon: 'sunny-outline' as const },
              { key: 'dark' as const, label: 'Dark', sub: 'OLED-friendly canvas', icon: 'moon-outline' as const },
            ] as const
          ).map((opt, i, arr) => (
            <ListRow
              key={opt.key}
              icon={opt.icon}
              title={opt.label}
              subtitle={opt.sub}
              onPress={() => setAppearance(opt.key)}
              isLast={i === arr.length - 1}>
              {preference === opt.key ? (
                <Text style={{ color: palette.neonMint, fontWeight: '700' }}>✓</Text>
              ) : (
                <View style={{ width: 16 }} />
              )}
            </ListRow>
          ))}
        </GlassCard>

        <SectionHeader title="Notifications" />
        <GlassCard style={styles.groupCard}>
          <ListRow icon="notifications-outline" title="Push notifications" subtitle="Votes, replies, outcomes" isLast={false}>
            <Switch
              accessibilityLabel="Push notifications"
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: surface.hairline, true: `${palette.neonMint}55` }}
              thumbColor={pushEnabled ? palette.neonMint : switchThumbOff}
            />
          </ListRow>
          <ListRow icon="mail-outline" title="Weekly digest" subtitle="Highlights from your circles" isLast={false}>
            <Switch
              accessibilityLabel="Weekly digest email"
              value={emailDigest}
              onValueChange={setEmailDigest}
              trackColor={{ false: surface.hairline, true: `${palette.neonMint}55` }}
              thumbColor={emailDigest ? palette.neonMint : switchThumbOff}
            />
          </ListRow>
          <ListRow icon="at" title="Mentions & tags" subtitle="When someone references you" isLast>
            <Switch
              accessibilityLabel="Mention alerts"
              value={mentionAlerts}
              onValueChange={setMentionAlerts}
              trackColor={{ false: surface.hairline, true: `${palette.neonMint}55` }}
              thumbColor={mentionAlerts ? palette.neonMint : switchThumbOff}
            />
          </ListRow>
        </GlassCard>

        <SectionHeader title="Privacy & data" />
        <GlassCard style={styles.groupCard}>
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
        </GlassCard>

        <SectionHeader title="Support" />
        <GlassCard style={styles.groupCard}>
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
              Alert.alert(
                'ShouldI',
                'Decision intelligence for real life. This build is a preview.',
              )
            }
            showChevron
            isLast
          />
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  groupLabel: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  groupCard: {
    marginTop: 0,
    padding: 0,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
