import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import {
  AppKit,
  AppKitProvider,
} from "@reown/appkit-react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

type AppKitInstance = typeof import("@/lib/appkit").appKit;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [appKitInstance, setAppKitInstance] =
    useState<AppKitInstance | null>(null);

  const [appKitError, setAppKitError] =
    useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initializeAppKit() {
      try {
        const module = await import("@/lib/appkit");

        if (mounted) {
          setAppKitInstance(module.appKit);
        }
      } catch (error) {
        console.error(
          "[FlowUSD] Failed to initialize AppKit:",
          error
        );

        if (mounted) {
          setAppKitError(
            error instanceof Error
              ? error.message
              : "Unable to initialize wallet connection."
          );
        }
      }
    }

    initializeAppKit();

    return () => {
      mounted = false;
    };
  }, []);

  const theme =
    colorScheme === "dark"
      ? DarkTheme
      : DefaultTheme;

  if (appKitError) {
    return (
      <ThemeProvider value={theme}>
        <View style={styles.loadingScreen}>
          <Text style={styles.errorTitle}>
            Wallet initialization failed
          </Text>

          <Text style={styles.errorText}>
            {appKitError}
          </Text>
        </View>
      </ThemeProvider>
    );
  }

  if (!appKitInstance) {
    return (
      <ThemeProvider value={theme}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator
            size="large"
            color="#1769ff"
          />

          <Text style={styles.loadingText}>
            Starting FlowUSD...
          </Text>
        </View>
      </ThemeProvider>
    );
  }

  return (
    <AppKitProvider instance={appKitInstance}>
      <ThemeProvider value={theme}>
        <AnimatedSplashOverlay />

        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />

          <Stack.Screen
            name="split-bill"
            options={{
              presentation: "card",
            }}
          />
        </Stack>

        <AppKit />
      </ThemeProvider>
    </AppKitProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f7fb",
  },

  loadingText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#667085",
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#161b22",
    textAlign: "center",
  },

  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    textAlign: "center",
  },
});