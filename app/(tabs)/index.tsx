import Constants from "expo-constants";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { benchmarks } from "../../benchmarks";
import type { BenchmarkResult, BenchmarkStatus } from "../../benchmarks/types";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ResultsChart } from "../../components/ResultsChart";

const hostURI = Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

const allIDs = new Set(benchmarks.map((b) => b.id));

export default function HomeScreen() {
  // https://jsonplaceholder.typicode.com/photos
  const [url, SHUrl] = useState(`http://${hostURI}:3001/employees_50MB.json`);
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<Record<string, BenchmarkResult>>({});
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(() => new Set(allIDs));

  const toggleBenchmark = (id: string) => {
    setSelectedBenchmarks((prev) => {
      const items = new Set(prev);
      items.has(id) ? items.delete(id) : items.add(id);
      return items;
    });
  };

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
      if (selectedBenchmarks.has(b.id)) {
        console.log(`Running benchmark: ${b.category} - ${b.name}`);
        await runBenchmark(b.id);
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResultsChart benchmarks={benchmarks} results={results} />
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
        <View style={styles.buttonRow}>
          <Button
            mode="contained-tonal"
            onPress={() => setSelectedBenchmarks(new Set(allIDs))}
            style={styles.flexButton}
          >
            Select All
          </Button>
          <Button
            mode="contained-tonal"
            onPress={() => setSelectedBenchmarks(new Set())}
            style={styles.flexButton}
          >
            Deselect All
          </Button>
        </View>
        <Button mode="contained" onPress={runAll} icon="play-box-multiple">
          Run Selected
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
            isSelected={selectedBenchmarks.has(b.id)}
            onToggle={() => toggleBenchmark(b.id)}
          />
        ))
      )}
    </ScrollView>
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
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
