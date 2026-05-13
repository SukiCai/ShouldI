import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Prefer `EXPO_PUBLIC_API_URL` in `.env.development` / `.env.development.local`.
 * In dev without that set, derive the hostname from Expo’s Metro host (`hostUri` /
 * `debuggerHost`) so Expo Go / simulators reach your Mac/LAN instead of guessing
 * `localhost`.
 */
function isTunnelHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes('exp.direct') || h.includes('ngrok');
}

/** Android emulator cannot use `localhost`/`127.0.0.1` to mean the host machine. */
function mapHostForAndroidEmulator(host: string): string {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') {
    return '10.0.2.2';
  }
  return host;
}

function expoDevMachineHostname(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  let host =
    (typeof hostUri === 'string' && hostUri.includes(':')
      ? hostUri.split(':')[0]
      : typeof hostUri === 'string'
        ? hostUri
        : null) ??
    Constants.expoGoConfig?.debuggerHost?.split(':')[0] ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost?.split(':')[0] ??
    null;

  if (!host?.trim()) {
    return null;
  }

  host = host.trim();

  if (isTunnelHostname(host)) {
    return null;
  }

  if (Platform.OS === 'android') {
    return mapHostForAndroidEmulator(host);
  }
  return host;
}

function devGatewayFallback(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8787';
  }
  if (Platform.OS === 'ios') {
    return 'http://localhost:8787';
  }
  return 'http://127.0.0.1:8787';
}

export const GATEWAY_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__
    ? (() => {
        const fromExpo = expoDevMachineHostname();
        if (fromExpo) {
          return `http://${fromExpo}:8787`;
        }
        return devGatewayFallback();
      })()
    : 'https://YOUR_HOSTED_GATEWAY.invalid');

export async function apiGetJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_ORIGIN}${path}`);
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(`GET ${path} failed (${hint}) → ${GATEWAY_ORIGIN}`);
  }
  if (!res.ok) {
    throw new Error(`GET ${path} HTTP ${res.status} → ${GATEWAY_ORIGIN}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_ORIGIN}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new Error(`POST ${path} failed (${hint}) → ${GATEWAY_ORIGIN}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`POST ${path}: response was not JSON (HTTP ${res.status}) → ${GATEWAY_ORIGIN}`);
  }

  if (!res.ok) {
    throw new Error(`POST ${path} HTTP ${res.status} → ${GATEWAY_ORIGIN}`);
  }

  return json as Promise<T>;
}
