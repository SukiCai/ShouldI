import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, themeSurface, typography } from '@/constants/theme';

export default function NotFoundScreen() {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: surface.canvas }]}>
        <Text style={[styles.title, { color: surface.textPrimary }]}>This screen doesn't exist.</Text>

        <Link href="/explore" style={styles.link}>
          <Text style={[styles.linkText, { color: palette.accent }]}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    ...typography.title,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    ...typography.compact,
  },
});
