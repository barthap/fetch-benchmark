import Constants from "expo-constants";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { benchmarks } from "../../benchmarks";
import { runMultiple } from "../../benchmarks/multi-run";
import type { BenchmarkStatus, MultiRunResult } from "../../benchmarks/types";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ResultsChart } from "../../components/ResultsChart";

const hostURI = Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

const allIDs = new Set(benchmarks.map((b) => b.id));

export default function HomeScreen() {
  // https://jsonplaceholder.typicode.com/photos
  const [url, SHUrl] = useState(`http://${hostURI}:3001/employees_50MB.json`);
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<Record<string, MultiRunResult>>({});
  const [runCount, setRunCount] = useState(3);
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
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
    try {
      setStatuses((prev) => ({ ...prev, [id]: "running" }));
      setResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      const multiResult = await runMultiple(() => benchmark.run(url), {
        runCount,
        onProgress: (current, total) => setRunProgress({ current, total }),
      });

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

  const medianResults = Object.fromEntries(
    Object.entries(results).map(([id, mr]) => [id, mr.median])
  );

  const exportResults = async () => {
    const data = {
      exportVersion: 2,
      device: Constants.deviceName ?? "unknown",
      timestamp: new Date().toISOString(),
      runCount,
      results: Object.fromEntries(
        Object.entries(results).map(([id, mr]) => [
          id,
          { median: mr.median, runs: mr.runs, warmUpRun: mr.warmUpRun },
        ])
      ),
    };
    await Share.share({ message: JSON.stringify(data, null, 2) });
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
      <ResultsChart benchmarks={benchmarks} results={medianResults} />
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text>Runs:</Text>
          <Button mode="outlined" compact onPress={() => setRunCount((c) => Math.max(1, c - 1))}>-</Button>
          <Text>{runCount}</Text>
          <Button mode="outlined" compact onPress={() => setRunCount((c) => Math.min(10, c + 1))}>+</Button>
        </View>
        {runProgress && (
          <Text style={{ textAlign: "center" }}>Run {runProgress.current}/{runProgress.total}</Text>
        )}
        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={runAll} icon="play-box-multiple" style={styles.flexButton}>
            Run Selected
          </Button>
          <Button mode="outlined" onPress={exportResults} icon="export-variant" style={styles.flexButton}>
            Export
          </Button>
        </View>
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
            result={results[b.id]?.median}
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
