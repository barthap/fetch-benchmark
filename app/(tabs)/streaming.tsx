import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { useState, useMemo } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import type { StreamingBenchmarkResult } from "../../benchmarks/streaming-types";
import { createStreamingBenchmarks } from "../../benchmarks/streaming";
import type { BenchmarkStatus } from "../../benchmarks/types";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ResultsChart } from "../../components/ResultsChart";

const hostURI = Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

type ImplKey = "before" | "after";

// Try to import the "after" module; fall back to undefined if not installed
let expoFetchNext: typeof expoFetch | undefined;
try {
  expoFetchNext = require("expo-fetch-next").fetch;
} catch {
  // Module not installed yet — "After" option will be disabled
}

export default function StreamingScreen() {
  const [baseUrl, setBaseUrl] = useState(`http://${hostURI}:3001`);
  const [activeImpl, setActiveImpl] = useState<ImplKey>("before");
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<Record<ImplKey, Record<string, StreamingBenchmarkResult>>>({
    before: {},
    after: {},
  });
  const [chartMetric, setChartMetric] = useState<"durationMs" | "timeToFirstChunkMs" | "throughputMbPerCc">("durationMs");

  const fetchFn = activeImpl === "after" && expoFetchNext ? expoFetchNext : expoFetch;
  const benchmarks = useMemo(() => createStreamingBenchmarks(fetchFn), [fetchFn]);
  const allIDs = useMemo(() => new Set(benchmarks.map((b) => b.id)), [benchmarks]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(() => new Set(allIDs));

  const currentResults = results[activeImpl];

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

    try {
      const result = await benchmark.run(baseUrl);
      setResults((prev) => ({
        ...prev,
        [activeImpl]: { ...prev[activeImpl], [id]: result },
      }));
      setStatuses((prev) => ({ ...prev, [id]: "success" }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setResults((prev) => ({
        ...prev,
        [activeImpl]: {
          ...prev[activeImpl],
          [id]: {
            durationMs: 0,
            sizeBytes: 0,
            timeToFirstChunkMs: 0,
            chunkCount: 0,
            error: message,
          },
        },
      }));
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const runAll = async () => {
    for (const b of benchmarks) {
      if (selectedBenchmarks.has(b.id)) {
        await runBenchmark(b.id);
      }
    }
  };

  const exportResults = async () => {
    const data = {
      device: `${Constants.deviceName ?? "unknown"}`,
      timestamp: new Date().toISOString(),
      results,
    };
    await Share.share({ message: JSON.stringify(data, null, 2) });
  };

  const metricButtons = [
    { value: "durationMs", label: "Duration" },
    { value: "timeToFirstChunkMs", label: "TTFC" },
    { value: "throughputMbPerCc", label: "Throughput" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResultsChart
        benchmarks={benchmarks}
        results={currentResults}
        title={`Streaming Results (${activeImpl})`}
        metricKey={chartMetric}
      />

      <View style={styles.controls}>
        <TextInput
          label="Server URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="url"
        />

        <SegmentedButtons
          value={activeImpl}
          onValueChange={(v) => setActiveImpl(v as ImplKey)}
          buttons={[
            { value: "before", label: "Before (stock)" },
            {
              value: "after",
              label: "After (patched)",
              disabled: !expoFetchNext,
            },
          ]}
        />

        <SegmentedButtons
          value={chartMetric}
          onValueChange={(v) => setChartMetric(v as typeof chartMetric)}
          buttons={metricButtons}
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

        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={runAll} icon="play-box-multiple" style={styles.flexButton}>
            Run Selected
          </Button>
          <Button mode="outlined" onPress={exportResults} icon="export-variant" style={styles.flexButton}>
            Export
          </Button>
        </View>
      </View>

      {benchmarks.map((b) => (
        <BenchmarkCard
          key={b.id}
          benchmark={b}
          status={statuses[b.id] || "idle"}
          result={currentResults[b.id]}
          onRun={() => runBenchmark(b.id)}
          isSelected={selectedBenchmarks.has(b.id)}
          onToggle={() => toggleBenchmark(b.id)}
        />
      ))}
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
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
