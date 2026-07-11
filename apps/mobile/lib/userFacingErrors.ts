/** Strip dev-only API error suffixes like `→ http://localhost:8787`. */
const DEV_ENDPOINT_SUFFIX = /\s*→\s*https?:\/\/\S+$/;

function isConnectionFailure(message: string): boolean {
  return (
    DEV_ENDPOINT_SUFFIX.test(message) ||
    /failed \(/.test(message) ||
    /network request failed/i.test(message) ||
    /fetch failed/i.test(message) ||
    /could not reach/i.test(message)
  );
}

/**
 * Map thrown API / network errors to copy safe to show in the app UI.
 */
export function userFacingApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof Error)) return fallback;

  const raw = error.message.replace(DEV_ENDPOINT_SUFFIX, '').trim();
  if (!raw) return fallback;

  if (isConnectionFailure(error.message) || isConnectionFailure(raw)) {
    return 'We couldn’t reach Harmence right now. Check your connection and try again.';
  }

  if (/^GET\s+\/|^POST\s+\//.test(raw)) {
    if (/HTTP 5\d\d/.test(raw)) {
      return 'Our servers are having trouble. Please try again in a moment.';
    }
    if (/HTTP 4\d\d/.test(raw)) {
      return 'That request couldn’t be completed. Please try again.';
    }
    if (/not JSON/i.test(raw)) {
      return 'We got an unexpected response. Please try again.';
    }
    return fallback;
  }

  if (/harmence unreachable/i.test(raw)) {
    return 'Harmence isn’t available right now. Please try again.';
  }

  return raw;
}

/** Assistant bubble shown when the intake chat cannot boot. */
export const HARMENCE_OFFLINE_BUBBLE =
  'Harmence isn’t available right now.\n\n' +
  'Check that you’re online, then tap the edit icon above to start a new chat.';

/** Past-sessions sheet helper — no backend jargon. */
export const PAST_SESSIONS_HINT =
  'Your recent decision chats appear here. Start a new chat anytime from the edit icon.';
