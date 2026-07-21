import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, themeSurface, typography } from '@/constants/theme';
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
        size={focused ? 20 : 19}
        importantForAccessibility="no"
        style={{ marginBottom: 0 }}
        {...rest}
      />
    </View>
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
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  /** Quiet intelligence accent — calm and consistent across themes. */
  const tabAccent = palette.accent;

  const barBg = surface.tabBar;
  const hairline = surface.tabBarBorder;

  return (
    <Tabs
      initialRouteName="explore"
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: tabAccent,
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
            paddingTop: 4,
            paddingBottom:
              Platform.OS === 'web'
                ? 6
                : Platform.OS === 'ios'
                  ? Math.max(insets.bottom, 4)
                  : Math.max(insets.bottom, 6),
            paddingHorizontal: Platform.OS === 'ios' ? 8 : 6,
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
          title: 'Decide',
          tabBarAccessibilityLabel: 'Decide: structured recommendation flow',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="check-circle" focused={focused} color={color} />,
          headerShown: false,
          tabBarButtonTestID: 'tab-decide',
        }}
      />
      <Tabs.Screen
        name="replay"
        listeners={tabListeners}
        options={{
          title: 'Replay',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="history" focused={focused} color={color} />,
          tabBarAccessibilityLabel: 'Outcome Replay: prediction versus reality',
          tabBarButtonTestID: 'tab-replay',
        }}
      />
      <Tabs.Screen
        name="you"
        listeners={tabListeners}
        options={{
          title: 'You',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="user-circle" focused={focused} color={color} />,
          tabBarAccessibilityLabel: 'You: profile, decision lens, and settings',
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0b1224',
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
    shadowRadius: Platform.OS === 'ios' ? 18 : 0,
    shadowOffset: { width: 0, height: -6 },
    elevation: Platform.OS === 'android' ? 10 : 0,
    overflow: 'visible',
  },
  tabBarIconStyle: {
    marginBottom: 1,
  },
  tabItem: {
    paddingVertical: 0,
    minWidth: 44,
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 0,
  },
  sideIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 22,
    marginBottom: 1,
  },
  tabLabel: {
    ...typography.nano,
    letterSpacing: 0.12,
    marginTop: 1,
    textAlign: 'center',
    maxWidth: 80,
  },
});
