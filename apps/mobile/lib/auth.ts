import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiPostJson } from '@/lib/api';
import type { DialCountry } from '@/constants/auth/dialCountries';

const AUTH_TOKEN_KEY = 'shouldi:auth-token:v1';

type AuthResponse = { userId: string; token: string };

let cachedToken: string | null | undefined; // undefined = not loaded yet from storage

/** Combines dial code + national digits into the E.164-ish shape the backend expects. */
export function toE164(phone: string, country: DialCountry): string {
  return `${country.dial}${phone.replace(/\D/g, '')}`;
}

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

async function storeToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* non-fatal — token still usable for this app session via the in-memory cache */
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getToken()) != null;
}

export async function signOut(): Promise<void> {
  cachedToken = null;
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* non-fatal */
  }
}

export async function signUp(phone: string, password: string): Promise<{ userId: string }> {
  const result = await apiPostJson<AuthResponse>('/v1/auth/signup', { phone, password });
  await storeToken(result.token);
  return { userId: result.userId };
}

export async function signIn(phone: string, password: string): Promise<{ userId: string }> {
  const result = await apiPostJson<AuthResponse>('/v1/auth/signin', { phone, password });
  await storeToken(result.token);
  return { userId: result.userId };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiPostJson<{ ok: true }>('/v1/auth/change-password', { currentPassword, newPassword });
}
