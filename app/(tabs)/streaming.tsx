import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { useState, useMemo } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import type { StreamingBenchmarkResult } from "../../benchmarks/streaming-types";
import { createStreamingBenchmarks } from "../../benchmarks/streaming";
import type { BenchmarkStatus, MultiRunResult } from "../../benchmarks/types";
import { runMultiple } from "../../benchmarks/multi-run";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ResultsChart } from "../../components/ResultsChart";

const hostURI = Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

type ImplKey = "before" | "after";

// Try to import the "after" module; fall back to undefined if not installed
let expoFetchNext: typeof expoFetch | undefined;
try {
  expoFetchNext = require("expo-fetch-next/fetch").fetch;
} catch {
  // Module not installed yet — "After" option will be disabled
}

export default function StreamingScreen() {
  const [baseUrl, setBaseUrl] = useState(`http://${hostURI}:3001`);
  const [activeImpl, setActiveImpl] = useState<ImplKey>("before");
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<
    Record<ImplKey, Record<string, MultiRunResult<StreamingBenchmarkResult>>>
  >({ before: {}, after: {} });
  const [runCount, setRunCount] = useState(3);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const [chartMetric, setChartMetric] = useState<"durationMs" | "timeToFirstChunkMs" | "throughputMbPerCc">("durationMs");

  const fetchFn = activeImpl === "after" && expoFetchNext ? expoFetchNext : expoFetch;
  const benchmarks = useMemo(() => createStreamingBenchmarks(fetchFn), [fetchFn]);
  const allIDs = useMemo(() => new Set(benchmarks.map((b) => b.id)), [benchmarks]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(() => new Set(allIDs));

  const currentMultiResults = results[activeImpl];
  const currentResults = Object.fromEntries(
    Object.entries(currentMultiResults)
      .filter(([, mr]) => mr != null)
      .map(([id, mr]) => [id, mr.median])
  );

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
    try {
      setStatuses((prev) => ({ ...prev, [id]: "running" }));
      setResults((prev) => ({
        ...prev,
        [activeImpl]: { ...prev[activeImpl], [id]: undefined },
      }));

      const multiResult = await runMultiple(
        () => benchmark.run(baseUrl) as Promise<StreamingBenchmarkResult>,
        {
          runCount,
          onProgress: (current, total) => setRunProgress({ current, total }),
        }
      );

      setResults((prev) => ({
        ...prev,
        [activeImpl]: { ...prev[activeImpl], [id]: multiResult },
      }));
      setStatuses((prev) => ({ ...prev, [id]: "success" }));
    } catch (e) {
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
      setResults((prev) => ({
        ...prev,
        [activeImpl]: {
          ...prev[activeImpl],
          [id]: {
            median: {
              durationMs: 0,
              sizeBytes: 0,
              timeToFirstChunkMs: 0,
              chunkCount: 0,
              error: e instanceof Error ? e.message : String(e),
            },
            runs: [],
            runCount: 0,
          },
        },
      }));
    } finally {
      setRunProgress(null);
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
      exportVersion: 2,
      device: Constants.deviceName ?? "unknown",
      timestamp: new Date().toISOString(),
      expoFetchVersion: Constants.expoConfig?.extra?.expoFetchVersion ?? "unknown",
      benchmarkAppVersion: Constants.expoConfig?.version ?? "unknown",
      runCount,
      results: Object.fromEntries(
        Object.entries(results).map(([impl, benchmarks]) => [
          impl,
          Object.fromEntries(
            Object.entries(benchmarks)
              .filter(([, mr]) => mr != null)
              .map(([id, mr]) => [
                id,
                { median: mr.median, runs: mr.runs, warmUpRun: mr.warmUpRun },
              ])
          ),
        ])
      ),
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text>Runs:</Text>
          <Button mode="outlined" compact onPress={() => setRunCount((c) => Math.max(1, c - 1))}>-</Button>
          <Text>{runCount}</Text>
          <Button mode="outlined" compact onPress={() => setRunCount((c) => Math.min(10, c + 1))}>+</Button>
        </View>

        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={runAll} icon="play-box-multiple" style={styles.flexButton}>
            Run Selected
          </Button>
          <Button mode="outlined" onPress={exportResults} icon="export-variant" style={styles.flexButton}>
            Export
          </Button>
        </View>

        {runProgress && (
          <Text style={{ textAlign: "center" }}>Run {runProgress.current}/{runProgress.total}</Text>
        )}
      </View>

      {benchmarks.map((b) => (
        <BenchmarkCard
          key={b.id}
          benchmark={b}
          status={statuses[b.id] || "idle"}
          result={currentMultiResults[b.id]?.median}
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
