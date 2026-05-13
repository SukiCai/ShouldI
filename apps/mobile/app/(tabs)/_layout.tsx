import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { palette } from '@/constants/theme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      initialRouteName="explore"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: palette.slate500,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="compass" color={color} />,
          tabBarAccessibilityLabel: 'Explore real outcomes feed',
        }}
      />
      <Tabs.Screen
        name="decide"
        options={{
          title: 'Decide',
          tabBarIcon: ({ color }) => <TabBarIcon name="clipboard" color={color} />,
          tabBarAccessibilityLabel: 'Start or resume a structured decision briefing',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          tabBarAccessibilityLabel: 'Account, controls, saved activity',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 18,
    height: 72,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 0,
    backgroundColor: 'rgba(253,254,255,0.96)',
    shadowColor: '#081128',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabItem: {
    borderRadius: 14,
    marginHorizontal: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
});
