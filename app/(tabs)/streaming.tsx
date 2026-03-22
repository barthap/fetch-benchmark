// app/(tabs)/streaming.tsx
import Constants from "expo-constants";
import { useState, useMemo } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { streamingTests, streamingImplementations } from "../../benchmarks/streaming";
import type { StreamingBenchmarkResult } from "../../benchmarks/streaming-types";
import type { BenchmarkStatus, Benchmark, MultiRunResult } from "../../benchmarks/types";
import { runMultiple } from "../../benchmarks/multi-run";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ResultsChart } from "../../components/ResultsChart";

const hostURI = Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

// Temporary bridge: flatten to old Benchmark[] shape
const enabledImpls = streamingImplementations.filter((i) => i.enabled);
const benchmarks: Benchmark[] = streamingTests.map((test) => ({
  id: test.id,
  name: test.name,
  description: test.description,
  category: "Streaming",
  run: (baseUrl: string) => test.run(enabledImpls[0], baseUrl),
}));

const allIDs = new Set(benchmarks.map((b) => b.id));

export default function StreamingScreen() {
  const [baseUrl, setBaseUrl] = useState(`http://${hostURI}:3001`);
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<Record<string, MultiRunResult<StreamingBenchmarkResult>>>({});
  const [runCount, setRunCount] = useState(3);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(() => new Set(allIDs));

  const currentResults = Object.fromEntries(
    Object.entries(results)
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
      setResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      const multiResult = await runMultiple(
        () => benchmark.run(baseUrl) as Promise<StreamingBenchmarkResult>,
        {
          runCount,
          onProgress: (current, total) => setRunProgress({ current, total }),
        }
      );

      setResults((prev) => ({ ...prev, [id]: multiResult }));
      setStatuses((prev) => ({ ...prev, [id]: "success" }));
    } catch (e) {
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
      setResults((prev) => ({
        ...prev,
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
        Object.entries(results)
          .filter(([, mr]) => mr != null)
          .map(([id, mr]) => [
            id,
            { median: mr.median, runs: mr.runs, warmUpRun: mr.warmUpRun },
          ])
      ),
    };
    await Share.share({ message: JSON.stringify(data, null, 2) });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResultsChart benchmarks={benchmarks} results={currentResults} />

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
          result={results[b.id]?.median}
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
