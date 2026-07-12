import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Tabs, useSegments } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOTION, usePrefersReducedMotion } from '@/constants/motion';
import { palette, profileLight, themeSurface } from '@/constants/theme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';

const FAB_RAISED = 40;
const FAB_INLINE = 22;
const FAB_LIFT = Platform.OS === 'ios' ? 6 : 5;

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

/** Middle slot: raised “+” CTA when inactive; springs inline with side tabs when Decide is active. */
function DecideFabTabButton(props: BottomTabBarButtonProps) {
  const { children: _children, style, ...rest } = props;
  const segments = useSegments();
  const onDecideRoute = (segments as string[]).includes('decide');
  const focused = !!rest.accessibilityState?.selected || onDecideRoute;
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const surface = themeSurface(scheme);
  const tabAccent = isDark ? palette.neonMint : profileLight.sky;
  const reducedMotion = usePrefersReducedMotion();
  const settle = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    settle.value = reducedMotion
      ? focused
        ? 1
        : 0
      : withSpring(focused ? 1 : 0, MOTION.tab);
  }, [focused, reducedMotion, settle]);

  const inlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(settle.value, [0.55, 1], [0, 1], 'clamp'),
  }));

  const raisedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(settle.value, [0, 0.45], [1, 0], 'clamp'),
    marginTop: interpolate(settle.value, [0, 1], [-FAB_LIFT, 0]),
    transform: [{ scale: interpolate(settle.value, [0, 1], [1, FAB_INLINE / FAB_RAISED]) }],
  }));

  const labelColor = focused ? tabAccent : surface.inactiveTab;

  return (
    <PlatformPressable
      {...rest}
      accessibilityLabel={rest.accessibilityLabel ?? 'Decide: start a structured choice'}
      accessibilityState={{ ...rest.accessibilityState, selected: focused }}
      style={[style, styles.tabItem]}
    >
      <View style={styles.decideAnchor} pointerEvents="none">
        <Animated.View style={[styles.decideLayer, inlineStyle]}>
          <TabBarIcon name="plus" focused={focused} color={labelColor} />
          <Text style={[styles.tabLabel, { color: labelColor }]} numberOfLines={1}>
            Decide
          </Text>
        </Animated.View>
        <Animated.View style={[styles.decideLayer, raisedStyle]}>
          <View style={[styles.decideFabRaised, isDark && styles.decideFabRaisedDark]}>
            <FontAwesome name="plus" size={16} color={palette.sheet} />
          </View>
          <Text style={[styles.tabLabel, { color: surface.inactiveTab }]} numberOfLines={1}>
            Decide
          </Text>
        </Animated.View>
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
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';
  /** Light: match Profile tab underline (sky). Dark: keep neon mint on OLED dock. */
  const tabAccent = isDark ? palette.neonMint : profileLight.sky;

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
          title: '',
          tabBarShowLabel: false,
          tabBarAccessibilityLabel: 'Decide: Harmence intake chat',
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
    fontSize: 9,
    letterSpacing: 0.12,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
    maxWidth: 80,
  },
  decideAnchor: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 34,
  },
  decideLayer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  decideFabRaised: {
    width: FAB_RAISED,
    height: FAB_RAISED,
    borderRadius: FAB_RAISED / 2,
    backgroundColor: palette.heroInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#0b1224',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  decideFabRaisedDark: {
    borderColor: 'rgba(255,255,255,0.22)',
    shadowOpacity: 0.35,
  },
});
