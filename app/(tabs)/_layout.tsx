/**
 * app/(tabs)/_layout.tsx
 *
 * Bottom tab bar with three tabs:
 *   1. Phrasebook — the main list of captured phrases
 *   2. Capture    — quick record / add phrase screen
 *   3. Settings   — export, import, delete data, donation link
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../src/constants/theme';

export default function TabLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBackground,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: Typography.size.xs,
          fontWeight: Typography.weight.medium,
        },
        headerStyle: { backgroundColor: Colors.tabBackground },
        headerTintColor: Colors.gold,
        headerTitleStyle: {
          fontWeight: Typography.weight.bold,
          color: Colors.textPrimary,
          fontSize: Typography.size.lg,
        },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Phrasebook',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
