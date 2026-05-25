import 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import 'react-native-reanimated';

import { palette, themeSurface } from '@/constants/theme';
import { AppearanceProvider, useAppearance } from '@/lib/appearance';

const navigationDark: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: palette.neonMint,
    background: palette.mist,
    card: palette.sheet,
    text: palette.textOnCanvas,
    border: palette.chromeHairline,
    notification: palette.neonPink,
  },
};

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <RootLayoutNav />
      </AppearanceProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const { resolvedScheme } = useAppearance();
  const isDark = resolvedScheme === 'dark';
  const surface = themeSurface(resolvedScheme);

  const navTheme: Theme = useMemo(() => {
    if (isDark) return navigationDark;
    return {
      ...DefaultTheme,
      dark: false,
      colors: {
        ...DefaultTheme.colors,
        primary: '#0d9488',
        background: surface.canvas,
        card: palette.sheet,
        text: surface.textPrimary,
        border: surface.hairline,
        notification: palette.neonPink,
      },
    };
  }, [isDark, surface.canvas, surface.hairline, surface.textPrimary]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="decision/[id]"
          options={{
            title: 'Decision details',
            /** Avoid default slide — Discuss uses an in-screen “expand” spring. */
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="plot-deck"
          options={{
            title: 'Plot Deck',
            headerTintColor: isDark ? palette.neonMint : '#0d9488',
            headerTitleStyle: { color: surface.textPrimary, fontWeight: '700' },
            headerStyle: { backgroundColor: surface.canvas },
            headerShadowVisible: false,
            headerBackTitle: 'Explore',
          }}
        />
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}
