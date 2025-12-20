import { Stack } from "expo-router";
import { Appbar, PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <Stack
          screenOptions={{
            header: (_props) => (
              <Appbar.Header>
                <Appbar.Content title="Fetch Benchmark" />
              </Appbar.Header>
            ),
          }}
        />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
