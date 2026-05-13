import { useColorScheme as useRNColorScheme } from 'react-native';

/** Wraps RN’s hook — explicit export avoids Hermes issues with some `export { … } from` re-exports. */
export function useColorScheme() {
  return useRNColorScheme();
}
