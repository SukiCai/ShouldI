import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_VOTE_COUNT_KEY = 'shouldi:guest-vote-count:v1';
const SAVE_PROGRESS_DISMISSED_KEY = 'shouldi:save-progress-dismissed:v1';
const AUTH_SESSION_KEY = 'shouldi:auth-session:v1';

export async function isAuthenticated(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    return !!token;
  } catch {
    return false;
  }
}

export type AuthPreviewProvider = 'phone' | 'apple' | 'google';

/** Preview stub — replace when real auth ships. */
export async function markAuthenticatedPreview(provider: AuthPreviewProvider = 'phone'): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_SESSION_KEY, `preview:${provider}`);
  } catch {
    /* non-fatal */
  }
}

export async function incrementGuestVoteCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_VOTE_COUNT_KEY);
    const next = (raw ? Number.parseInt(raw, 10) : 0) + 1;
    const safe = Number.isFinite(next) ? next : 1;
    await AsyncStorage.setItem(GUEST_VOTE_COUNT_KEY, String(safe));
    return safe;
  } catch {
    return 1;
  }
}

export async function shouldPromptSaveProgress(): Promise<boolean> {
  if (await isAuthenticated()) return false;
  try {
    const dismissed = await AsyncStorage.getItem(SAVE_PROGRESS_DISMISSED_KEY);
    return dismissed !== '1';
  } catch {
    return true;
  }
}

export async function dismissSaveProgressPrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_PROGRESS_DISMISSED_KEY, '1');
  } catch {
    /* non-fatal */
  }
}
