import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'wrench', selected: 'wrench.fill' }} />
        <Label>Jobs</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vehicles">
        <Icon sf={{ default: 'car', selected: 'car.fill' }} />
        <Label>Vehicles</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sync">
        <Icon sf={{ default: 'arrow.triangle.2.circlepath', selected: 'arrow.triangle.2.circlepath' }} />
        <Label>Sync</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'systemChromeMaterial'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="wrench" tintColor={color} size={24} />
            ) : (
              <Feather name="tool" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: 'Vehicles',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="car" tintColor={color} size={24} />
            ) : (
              <Feather name="truck" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="arrow.triangle.2.circlepath" tintColor={color} size={24} />
            ) : (
              <Feather name="refresh-cw" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
