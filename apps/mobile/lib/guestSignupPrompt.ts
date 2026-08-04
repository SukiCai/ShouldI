import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAuthenticated } from '@/lib/auth';

const GUEST_VOTE_COUNT_KEY = 'shouldi:guest-vote-count:v1';
const SAVE_PROGRESS_DISMISSED_KEY = 'shouldi:save-progress-dismissed:v1';

export { isAuthenticated };

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
