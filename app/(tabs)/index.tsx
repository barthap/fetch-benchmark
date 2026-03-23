// app/(tabs)/index.tsx
import Constants from "expo-constants";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import {
  wholeBodyTests,
  wholeBodyImplementations,
} from "../../benchmarks/whole-body";
import type { ResultsMap } from "../../benchmarks/implementation";
import { METRICS } from "../../benchmarks/metrics";
import { runMultiple } from "../../benchmarks/multi-run";
import type { BenchmarkResult } from "../../benchmarks/types";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ImplementationSelector } from "../../components/ImplementationSelector";
import { MetricSelector } from "../../components/MetricSelector";
import { ResultsChartGroup } from "../../components/ResultsChartGroup";

const hostURI =
  Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

// Metrics available for whole-body chart
const wholeBodyMetrics = METRICS.filter((m) =>
  [
    "durationMs",
    "throughputMbPerCc",
    "memoryDeltaBytes",
    "jsThreadCpuMs",
    "gcCount",
  ].includes(m.key),
);

export default function HomeScreen() {
  const theme = useTheme();
  const [url, setUrl] = useState(
    `http://${hostURI}:3001/employees_50MB.json`,
  );
  const [runCount, setRunCount] = useState(3);
  const [chartMetric, setChartMetric] = useState("durationMs");

  const [selectedTests, setSelectedTests] = useState<Set<string>>(
    () => new Set(wholeBodyTests.map((t) => t.id)),
  );
  const [selectedImpls, setSelectedImpls] = useState<Set<string>>(
    () =>
      new Set(
        wholeBodyImplementations.filter((i) => i.enabled).map((i) => i.id),
      ),
  );

  const [results, setResults] = useState<ResultsMap>({});
  const [runningState, setRunningState] = useState<{
    testId: string;
    implId: string;
    runIndex: number;
    runCount: number;
  } | null>(null);

  const toggleTest = (id: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleImpl = (id: string) => {
    setSelectedImpls((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runAll = async () => {
    const tests = wholeBodyTests.filter((t) => selectedTests.has(t.id));
    const impls = wholeBodyImplementations.filter(
      (i) => i.enabled && selectedImpls.has(i.id),
    );

    for (const test of tests) {
      for (const impl of impls) {
        try {
          setRunningState({
            testId: test.id,
            implId: impl.id,
            runIndex: 0,
            runCount,
          });

          const multiResult = await runMultiple(
            () => test.run(impl, url),
            {
              runCount,
              onProgress: (current, total) =>
                setRunningState({
                  testId: test.id,
                  implId: impl.id,
                  runIndex: current,
                  runCount: total,
                }),
            },
          );

          setResults((prev) => ({
            ...prev,
            [impl.id]: {
              ...prev[impl.id],
              [test.id]: multiResult,
            },
          }));
        } catch (e) {
          setResults((prev) => ({
            ...prev,
            [impl.id]: {
              ...prev[impl.id],
              [test.id]: {
                median: {
                  durationMs: 0,
                  sizeBytes: 0,
                  error: e instanceof Error ? e.message : String(e),
                },
                runs: [],
                runCount: 0,
              },
            },
          }));
        }
      }
    }
    setRunningState(null);
  };

  const exportResults = async () => {
    const data = {
      exportVersion: 3,
      device: Constants.deviceName ?? "unknown",
      timestamp: new Date().toISOString(),
      expoFetchVersion:
        Constants.expoConfig?.extra?.expoFetchVersion ?? "unknown",
      benchmarkAppVersion: Constants.expoConfig?.version ?? "unknown",
      runCount,
      results,
    };
    await Share.share({ message: JSON.stringify(data, null, 2) });
  };

  const hasAnyResults = Object.keys(results).length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Config Bar */}
      <View style={styles.controls}>
        <TextInput
          label="Target URL"
          value={url}
          onChangeText={setUrl}
          mode="outlined"
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={styles.row}>
          <View style={styles.row}>
            <Text>Runs:</Text>
            <Button
              mode="outlined"
              compact
              onPress={() => setRunCount((c) => Math.max(1, c - 1))}
            >
              -
            </Button>
            <Text>{runCount}</Text>
            <Button
              mode="outlined"
              compact
              onPress={() => setRunCount((c) => Math.min(10, c + 1))}
            >
              +
            </Button>
          </View>
        </View>
        <MetricSelector
          metrics={wholeBodyMetrics}
          selected={chartMetric}
          onSelect={setChartMetric}
        />
      </View>

      {/* Charts */}
      {hasAnyResults && (
        <ResultsChartGroup
          tests={wholeBodyTests}
          implementations={wholeBodyImplementations.filter(
            (i) => selectedImpls.has(i.id) && i.enabled,
          )}
          results={results}
          metricKey={chartMetric}
        />
      )}

      {/* Implementations */}
      <ImplementationSelector
        implementations={wholeBodyImplementations}
        selected={selectedImpls}
        onToggle={toggleImpl}
      />

      {/* Run Controls */}
      <View style={styles.buttonRow}>
        <Button
          mode="contained"
          onPress={runAll}
          icon="play-box-multiple"
          style={styles.flexButton}
          disabled={runningState !== null}
        >
          {runningState ? "Running…" : "Run Selected"}
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() =>
            setSelectedTests(new Set(wholeBodyTests.map((t) => t.id)))
          }
          style={styles.flexButton}
        >
          Select All
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => setSelectedTests(new Set())}
          style={styles.flexButton}
        >
          Deselect
        </Button>
        <Button
          mode="outlined"
          onPress={exportResults}
          icon="export-variant"
          style={styles.flexButton}
        >
          Export
        </Button>
      </View>

      {/* Test Cards */}
      {wholeBodyTests.map((test) => {
        const testResults: Record<string, any> = {};
        for (const impl of wholeBodyImplementations) {
          if (results[impl.id]?.[test.id]) {
            testResults[impl.id] = results[impl.id][test.id];
          }
        }
        const hasResult = Object.keys(testResults).length > 0;

        return (
          <BenchmarkCard
            key={test.id}
            testId={test.id}
            testName={test.name}
            testDescription={test.description}
            implementations={wholeBodyImplementations}
            results={testResults}
            isSelected={selectedTests.has(test.id)}
            onToggle={() => toggleTest(test.id)}
            runningState={
              runningState?.testId === test.id ? runningState : null
            }
            hasAnyResult={hasResult}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  controls: {
    marginBottom: 16,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  flexButton: {
    flex: 1,
  },
});
