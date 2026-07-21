import { palette, semantic, themeSurface, typography } from '@/constants/theme';
import { GATEWAY_ORIGIN } from '@/lib/api';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Button, Card, Chip, EmptyState, TextField } from '@/components/ui';
import { Body, Caption, Eyebrow, Title } from '@/components/ui/AppText';
import { useColorScheme } from '@/components/useColorScheme';

export default function ModalScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const [ping, setPing] = React.useState<{ ok: boolean | null; ms: number | null; detail?: string }>({
    ok: null,
    ms: null,
  });

  async function pingHealth(): Promise<void> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${GATEWAY_ORIGIN}/health`);
      const body = await res.text();
      setPing({
        ok: res.ok,
        ms: Date.now() - t0,
        detail: `${res.status} ${body.slice(0, 160)}`,
      });
    } catch (e) {
      setPing({
        ok: false,
        ms: Date.now() - t0,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { backgroundColor: surface.canvas }]}
      style={{ backgroundColor: surface.canvas }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: surface.textPrimary }]}>Diagnostics (dev)</Text>
        <View style={styles.block}>
          <Text style={[styles.label, { color: surface.textMuted }]}>API base (effective)</Text>
          <Text style={[styles.mono, { color: surface.textPrimary }]}>{GATEWAY_ORIGIN}</Text>
          <Text style={[styles.hint, { color: surface.textMuted }]}>
            Override with EXPO_PUBLIC_API_URL in apps/mobile/.env.development.
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={[styles.label, { color: surface.textMuted }]}>Reachability</Text>
          <Pressable style={styles.button} onPress={() => void pingHealth()}>
            <Text style={styles.buttonText}>GET /health</Text>
          </Pressable>
          {ping.ms != null ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.mono, { color: surface.textPrimary }]}>{ping.detail ?? ''}</Text>
              <Text style={[styles.small, { color: surface.textMuted }]}>{`${ping.ms} ms`}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.separator, { backgroundColor: surface.hairline }]} />
        <Text style={[styles.title, { color: surface.textPrimary, fontSize: 18 }]}>UI primitives (dev)</Text>
        <View style={styles.gallery}>
          <Eyebrow>Buttons</Eyebrow>
          <Button label="Primary" onPress={() => undefined} style={styles.galleryItem} />
          <Button label="Secondary" variant="secondary" onPress={() => undefined} style={styles.galleryItem} />
          <Button label="Ghost" variant="ghost" onPress={() => undefined} style={styles.galleryItem} />
          <Button label="Gradient" variant="gradient" onPress={() => undefined} style={styles.galleryItem} />
          <Eyebrow style={{ marginTop: 12 }}>Chips & fields</Eyebrow>
          <View style={styles.chipRow}>
            <Chip>Option A</Chip>
            <Chip selected>Selected</Chip>
          </View>
          <TextField label="Email" placeholder="you@example.com" containerStyle={styles.galleryItem} />
          <Eyebrow style={{ marginTop: 12 }}>Cards</Eyebrow>
          <Card style={styles.galleryItem}>
            <Title>Surface card</Title>
            <Body tone="muted">Standard grouped surface with rest elevation.</Body>
          </Card>
          <Card variant="council" style={styles.galleryItem}>
            <Title>Council card</Title>
            <Caption>Violet accent bar for Expert Council flows.</Caption>
          </Card>
          <EmptyState
            title="Nothing here yet"
            body="Shared empty state for Explore, Decide, and Outcome Replay."
            actionLabel="Retry"
            onAction={() => undefined}
          />
        </View>
        <View style={[styles.separator, { backgroundColor: surface.hairline }]} />
        <EditScreenInfo path="app/modal.tsx" />

        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  container: {
    flex: 1,
    alignItems: 'stretch',
    padding: 24,
    paddingBottom: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    ...typography.title,
    marginBottom: 16,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: 4,
  },
  block: {
    marginBottom: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: semantic.actionPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  small: { fontSize: 11, marginTop: 4 },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '100%',
  },
  gallery: {
    gap: 10,
    marginBottom: 8,
  },
  galleryItem: {
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
});
