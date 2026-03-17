/**
 * app/_layout.tsx
 *
 * Root layout — the entry point of the Expo Router app.
 *
 * Responsibilities:
 *   1. Prevent the splash screen from auto-hiding until the DB is ready.
 *   2. Wrap the entire tree in DatabaseProvider.
 *   3. Render a loading indicator while DB is initialising.
 *   4. Render an error screen if DB initialisation fails.
 *   5. Set the global navigation theme and status bar style.
 *
 * Every screen in the app is a descendant of this layout and therefore has
 * access to the database via the useDb() hook.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DatabaseProvider } from '../src/context/DatabaseContext';
import { Colors, Typography, Spacing } from '../src/constants/theme';

// Keep the splash screen visible while we initialise the database.
SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Loading / error screens
// ---------------------------------------------------------------------------

function LoadingView(): React.JSX.Element {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.gold} />
      <Text style={styles.loadingText}>Opening the phrasebook…</Text>
    </View>
  );
}

function ErrorView({ error }: { error: Error }): React.JSX.Element {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>Failed to open phrasebook</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Text style={styles.errorHint}>
        Try reinstalling the app. Your data is preserved in the device storage.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout(): React.JSX.Element {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  const handleDbReady = useCallback(async () => {
    setDbReady(true);
    // Wait one frame before hiding the splash to avoid a flash of unstyled content
    requestAnimationFrame(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider
        onReady={handleDbReady}
      >
        <StatusBar style="light" backgroundColor={Colors.background} />

        {!dbReady && !dbError ? (
          <LoadingView />
        ) : dbError ? (
          <ErrorView error={dbError} />
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.tabBackground },
              headerTintColor: Colors.gold,
              headerTitleStyle: {
                fontWeight: Typography.weight.bold,
                color: Colors.textPrimary,
              },
              contentStyle: { backgroundColor: Colors.background },
              // Standard back button on iOS; custom on Android via headerLeft
              headerBackVisible: true,
            }}
          >
            {/* The (tabs) group renders the bottom tab bar */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="phrase/new"
              options={{
                title: 'New Phrase',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="phrase/[id]"
              options={{
                title: 'Phrase',
                // Title overridden dynamically in the screen
              }}
            />
          </Stack>
        )}
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.base,
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
  errorTitle: {
    color: Colors.danger,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.size.base,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  errorHint: {
    color: Colors.textMuted,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
