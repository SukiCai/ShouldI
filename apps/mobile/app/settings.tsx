import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { GlassCard, SectionHeader } from '@/components/ui/Premium';
import { palette, spacing, themeSurface, typography } from '@/constants/theme';
import type { AppearancePreference } from '@/lib/appearance';
import { useAppearance } from '@/lib/appearance';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
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

  const Row = ({
    icon,
    title,
    subtitle,
    children,
    onPress,
    showChevron,
    isLast,
  }: {
    icon: React.ComponentProps<typeof FontAwesome>['name'];
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    onPress?: () => void;
    showChevron?: boolean;
    isLast?: boolean;
  }) => (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surface.hairline },
        onPress && pressed && { backgroundColor: surface.pressedOverlay },
      ]}>
      <View style={styles.rowIconWrap}>
        <FontAwesome name={icon} size={17} color={palette.neonMint} />
      </View>
      <View style={styles.rowText}>
        <Text style={[typography.compact, { color: surface.textPrimary, fontWeight: '600' }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: surface.textMuted, marginTop: 3 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
      {showChevron ? (
        <FontAwesome name="chevron-right" size={14} color={surface.textMuted} style={{ marginLeft: 8 }} />
      ) : null}
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: surface.canvas, paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.75 },
          ]}>
          <FontAwesome name="chevron-left" size={18} color={surface.textPrimary} />
        </Pressable>
        <Text style={[typography.title, { color: surface.textPrimary, fontWeight: '700' }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40), paddingHorizontal: 20 }}>
        <Text style={[typography.caption, styles.groupLabel, { color: surface.textMuted }]}>Appearance</Text>
        <GlassCard style={styles.groupCard}>
          {(
            [
              { key: 'system' as const, label: 'System default', sub: 'Match this device' },
              { key: 'light' as const, label: 'Light', sub: 'Bright surfaces' },
              { key: 'dark' as const, label: 'Dark', sub: 'OLED-friendly canvas' },
            ] as const
          ).map((opt, i, arr) => (
            <Row
              key={opt.key}
              icon={opt.key === 'system' ? 'circle-o' : opt.key === 'light' ? 'sun-o' : 'moon-o'}
              title={opt.label}
              subtitle={opt.sub}
              onPress={() => setAppearance(opt.key)}
              isLast={i === arr.length - 1}
              showChevron={false}>
              {preference === opt.key ? (
                <FontAwesome name="check" size={16} color={palette.neonMint} />
              ) : (
                <View style={{ width: 16 }} />
              )}
            </Row>
          ))}
        </GlassCard>

        <SectionHeader title="Notifications" />
        <GlassCard style={styles.groupCard}>
          <Row icon="bell" title="Push notifications" subtitle="Votes, replies, outcomes" isLast={false}>
            <Switch
              accessibilityLabel="Push notifications"
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: surface.hairline, true: `${palette.neonMint}55` }}
              thumbColor={pushEnabled ? palette.neonMint : palette.sheet}
            />
          </Row>
          <Row icon="envelope-o" title="Weekly digest" subtitle="Highlights from your circles" isLast={false}>
            <Switch
              accessibilityLabel="Weekly digest email"
              value={emailDigest}
              onValueChange={setEmailDigest}
              trackColor={{ false: surface.hairline, true: `${palette.neonMint}55` }}
              thumbColor={emailDigest ? palette.neonMint : palette.sheet}
            />
          </Row>
          <Row icon="at" title="Mentions & tags" subtitle="When someone references you" isLast>
            <Switch
              accessibilityLabel="Mention alerts"
              value={mentionAlerts}
              onValueChange={setMentionAlerts}
              trackColor={{ false: surface.hairline, true: `${palette.neonMint}55` }}
              thumbColor={mentionAlerts ? palette.neonMint : palette.sheet}
            />
          </Row>
        </GlassCard>

        <SectionHeader title="Privacy & data" />
        <GlassCard style={styles.groupCard}>
          <Row
            icon="lock"
            title="Privacy center"
            subtitle="Visibility, blocked accounts, data"
            onPress={() =>
              Alert.alert('Privacy center', 'Export, clear cache, and audience controls will live here.')
            }
            showChevron
            isLast={false}
          />
          <Row
            icon="eye"
            title="Ad & personalization"
            subtitle="Tune recommendations"
            onPress={() => Alert.alert('Personalization', 'Fine-grained ad and recommendation controls ship with v1.')}
            showChevron
            isLast
          />
        </GlassCard>

        <SectionHeader title="Support" />
        <GlassCard style={styles.groupCard}>
          <Row
            icon="question-circle"
            title="Help & FAQ"
            onPress={() => Alert.alert('Help', 'Support and guides will open in-browser shortly.')}
            showChevron
            isLast={false}
          />
          <Row
            icon="comment"
            title="Send feedback"
            onPress={() => Alert.alert('Feedback', 'Thanks — we read every note.')}
            showChevron
            isLast={false}
          />
          <Row
            icon="info-circle"
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowIconWrap: {
    width: 36,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    paddingRight: 8,
  },
});
