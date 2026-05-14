import { palette } from '@/constants/theme';
import { GATEWAY_ORIGIN } from '@/lib/api';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text } from '@/components/Themed';

export default function ModalScreen() {
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
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>Diagnostics (dev)</Text>
        <View style={styles.block}>
          <Text style={styles.label}>API base (effective)</Text>
          <Text style={styles.mono}>{GATEWAY_ORIGIN}</Text>
          <Text style={styles.hint}>Override with EXPO_PUBLIC_API_URL in apps/mobile/.env.development.</Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>Reachability</Text>
          <Pressable style={styles.button} onPress={() => void pingHealth()}>
            <Text style={styles.buttonText}>GET /health</Text>
          </Pressable>
          {ping.ms != null ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.mono}>{ping.detail ?? ''}</Text>
              <Text style={styles.small}>{`${ping.ms} ms`}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.separator} />
        <EditScreenInfo path="app/modal.tsx" />

        {/* Use a light status bar on iOS to account for the black space above the modal */}
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
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
    opacity: 0.6,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  small: { fontSize: 11, opacity: 0.6, marginTop: 4 },
  separator: {
    marginVertical: 20,
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.35)',
    width: '100%',
  },
});
