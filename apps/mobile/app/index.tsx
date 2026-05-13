import { Redirect } from 'expo-router';

/**
 * Cold start hits `/` — without this file, Expo Router has no matching leaf and shows +not-found.
 */
export default function Index() {
  return <Redirect href="/explore" />;
}
