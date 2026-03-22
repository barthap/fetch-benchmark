// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";

SystemUI.setBackgroundColorAsync("#1a1a2e");

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={MD3DarkTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
