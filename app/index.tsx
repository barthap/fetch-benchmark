import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { benchmarks } from "../benchmarks";
import type { BenchmarkResult, BenchmarkStatus } from "../benchmarks/types";
import { BenchmarkCard } from "../components/BenchmarkCard";

export default function HomeScreen() {
  const [url, SHUrl] = useState("https://jsonplaceholder.typicode.com/photos");
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<Record<string, BenchmarkResult>>({});

  const runBenchmark = async (id: string) => {
    const benchmark = benchmarks.find((b) => b.id === id);
    if (!benchmark) return;

    setStatuses((prev) => ({ ...prev, [id]: "running" }));
    setResults((prev) => {
      const newResults = { ...prev };
      delete newResults[id];
      return newResults;
    });

    try {
      const result = await benchmark.run(url);
      setResults((prev) => ({ ...prev, [id]: result }));
      setStatuses((prev) => ({ ...prev, [id]: "success" }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setResults((prev) => ({
        ...prev,
        [id]: {
          durationMs: 0,
          sizeBytes: 0,
          error: message,
        },
      }));
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const runAll = async () => {
    for (const b of benchmarks) {
      await runBenchmark(b.id);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <Appbar.Header elevated>
        <Appbar.Content title="Fetch Benchmark" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.controls}>
          <TextInput
            label="Target URL"
            value={url}
            onChangeText={SHUrl}
            mode="outlined"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Button mode="contained-tonal" onPress={runAll} icon="play-box-multiple">
            Run All
          </Button>
        </View>

        {benchmarks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="bodyLarge">No benchmarks registered yet.</Text>
          </View>
        ) : (
          benchmarks.map((b) => (
            <BenchmarkCard
              key={b.id}
              benchmark={b}
              status={statuses[b.id] || "idle"}
              result={results[b.id]}
              onRun={() => runBenchmark(b.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  controls: {
    marginBottom: 20,
    gap: 12,
  },
  input: {
    backgroundColor: "white",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 40,
  },
});
