import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, themeSurface } from '@/constants/theme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused?: boolean;
}) {
  const { focused, ...rest } = props;
  return (
    <View style={styles.sideIconWrap} accessibilityElementsHidden={false}>
      <FontAwesome
        size={focused ? 21 : 20}
        importantForAccessibility="no"
        style={{ marginBottom: 0 }}
        {...rest}
      />
    </View>
  );
}

/** Middle slot: subtle raised “+” that matches the dock instead of hovering awkwardly far above it. */
function DecideFabTabButton(props: BottomTabBarButtonProps) {
  const { children: _children, style, ...rest } = props;
  const focused = !!rest.accessibilityState?.selected;
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const surface = themeSurface(scheme);

  return (
    <PlatformPressable
      {...rest}
      accessibilityLabel={rest.accessibilityLabel ?? 'Decide: start a structured choice'}
      style={[style, styles.decideHitArea]}
    >
      <View style={styles.decideSlot} pointerEvents="none">
        <View
          style={[
            styles.decideFab,
            isDark && styles.decideFabDark,
            focused && styles.decideFabFocused,
            focused && !isDark && styles.decideFabFocusedLight,
            focused && isDark && styles.decideFabFocusedDark,
          ]}
          accessibilityElementsHidden={false}>
          <FontAwesome name="plus" size={18} color={palette.sheet} />
        </View>
        <Text
          style={[
            styles.decideFabCaption,
            { color: focused ? palette.neonMint : surface.inactiveTab },
          ]}
          numberOfLines={1}>
          Decide
        </Text>
      </View>
    </PlatformPressable>
  );
}

const tabListeners =
  Platform.OS !== 'web'
    ? ({
        tabPress() {
          void Haptics.selectionAsync().catch(() => undefined);
        },
      } as const)
    : {};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 6);
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  const barBg = surface.tabBar;
  const hairline = surface.tabBarBorder;

  return (
    <Tabs
      initialRouteName="explore"
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: palette.neonMint,
        tabBarInactiveTintColor: surface.inactiveTab,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.tabLabel,
        tabBarAllowFontScaling: true,
        tabBarIconStyle: styles.tabBarIconStyle,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? bottomPad + 2 : Math.max(bottomPad + 4, 12),
            paddingHorizontal: Platform.OS === 'ios' ? 10 : 6,
            backgroundColor: barBg,
            borderTopColor: hairline,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="explore"
        listeners={tabListeners}
        options={{
          title: 'Explore',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="compass" focused={focused} color={color} />,
          tabBarAccessibilityLabel: 'Explore: real decisions and community outcomes',
          tabBarButtonTestID: 'tab-explore',
        }}
      />
      <Tabs.Screen
        name="decide"
        listeners={tabListeners}
        options={{
          title: '',
          tabBarShowLabel: false,
          tabBarAccessibilityLabel: 'Decide: start a structured choice',
          tabBarIcon: () => null,
          headerShown: false,
          tabBarButton: DecideFabTabButton,
          tabBarButtonTestID: 'tab-decide',
        }}
      />
      <Tabs.Screen
        name="you"
        listeners={tabListeners}
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="user-circle" focused={focused} color={color} />,
          tabBarAccessibilityLabel: 'Profile: account, settings, saved activity',
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderRadius: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0b1224',
    shadowOpacity: Platform.OS === 'ios' ? 0.48 : 0,
    shadowRadius: Platform.OS === 'ios' ? 14 : 0,
    shadowOffset: { width: 0, height: -2 },
    elevation: Platform.OS === 'android' ? 6 : 0,
    overflow: 'visible',
  },
  tabBarIconStyle: {
    marginBottom: 2,
  },
  tabItem: {
    paddingVertical: 0,
    minWidth: 48,
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 2 : 0,
  },
  sideIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 24,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.15,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 88,
  },
  decideHitArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  decideSlot: {
    alignItems: 'center',
    gap: 3,
    marginTop: Platform.OS === 'ios' ? -10 : -8,
  },
  decideFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.heroInk,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1224',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === 'android' ? 6 : 0,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  decideFabDark: {
    borderColor: 'rgba(255,255,255,0.22)',
    shadowOpacity: 0.35,
  },
  decideFabFocused: {
    shadowOpacity: 0.26,
    shadowRadius: Platform.OS === 'ios' ? 10 : 6,
    shadowOffset: { width: 0, height: 3 },
  },
  decideFabFocusedLight: {
    borderColor: palette.neonMint,
    borderWidth: 2,
  },
  decideFabFocusedDark: {
    borderWidth: 2,
    borderColor: `${palette.neonSky}99`,
  },
  decideFabCaption: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.12,
    textAlign: 'center',
    color: palette.textMutedOnCanvas,
    maxWidth: 88,
    marginBottom: Platform.OS === 'android' ? 2 : 0,
  },
  decideFabCaptionDim: {},
  decideFabCaptionFocused: {
    color: palette.neonMint,
  },
});
