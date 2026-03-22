import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Checkbox, Text, useTheme } from "react-native-paper";
import type { Benchmark, BenchmarkResult, BenchmarkStatus } from "../benchmarks/types";
import type { StreamingBenchmarkResult } from "../benchmarks/streaming-types";
import { formatBytes } from "../benchmarks/utils";

interface Props {
  benchmark: Benchmark;
  status: BenchmarkStatus;
  result?: BenchmarkResult;
  onRun: () => void;
  isSelected: boolean;
  onToggle: () => void;
}

export function BenchmarkCard({ benchmark, status, result, onRun, isSelected, onToggle }: Props) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View
              style={[
                styles.checkboxWrapper,
                { marginRight: 8 }, // Added margin here
                !isSelected && { borderColor: theme.colors.outlineVariant },
              ]}
            >
              <Checkbox
                status={isSelected ? "checked" : "unchecked"}
                onPress={onToggle}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium">{`${benchmark.category}: ${benchmark.name}`}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {benchmark.description}
              </Text>
            </View>
          </View>
          {status === "running" && <ActivityIndicator animating={true} size="small" />}
        </View>

        {status === "error" && result?.error && (
          <Text style={{ color: theme.colors.error, marginTop: 8 }}>Error: {result.error}</Text>
        )}

        {status === "success" && result && (
          <>
          <View style={styles.results}>
            <View style={styles.metric}>
              <Text variant="labelSmall">Time</Text>
              <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                {result.durationMs} ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text variant="labelSmall">Size</Text>
              <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                {formatBytes(result.sizeBytes)}
              </Text>
            </View>
            {result.throughputMbPerCc !== undefined && (
              <View style={styles.metric}>
                <Text variant="labelSmall">Speed</Text>
                <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                  {result.throughputMbPerCc.toFixed(2)} MB/s
                </Text>
              </View>
            )}
            {(result as StreamingBenchmarkResult).timeToFirstChunkMs !== undefined && (
              <View style={styles.metric}>
                <Text variant="labelSmall">TTFC</Text>
                <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                  {(result as StreamingBenchmarkResult).timeToFirstChunkMs.toFixed(1)} ms
                </Text>
              </View>
            )}
            {(result as StreamingBenchmarkResult).chunkCount !== undefined && (
              <View style={styles.metric}>
                <Text variant="labelSmall">Chunks</Text>
                <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                  {(result as StreamingBenchmarkResult).chunkCount}
                </Text>
              </View>
            )}
            {(result as StreamingBenchmarkResult).droppedFrames !== undefined && (
              <View style={styles.metric}>
                <Text variant="labelSmall">Drops</Text>
                <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                  {(result as StreamingBenchmarkResult).droppedFrames}
                </Text>
              </View>
            )}
          </View>
          {(result.memoryDeltaBytes != null ||
            result.jsThreadCpuMs != null ||
            result.gcCount != null) && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e0e0e0" }}>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: "#666", marginBottom: 4 }}>
                Native Metrics
              </Text>
              {result.memoryDeltaBytes != null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Memory delta</Text>
                  <Text style={styles.metricValue}>
                    {result.memoryDeltaBytes >= 0 ? "+" : ""}
                    {formatBytes(Math.abs(result.memoryDeltaBytes))}
                  </Text>
                </View>
              )}
              {result.jsThreadCpuMs != null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>JS CPU time</Text>
                  <Text style={styles.metricValue}>{result.jsThreadCpuMs} ms</Text>
                </View>
              )}
              {result.gcCount != null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>GC</Text>
                  <Text style={styles.metricValue}>
                    {result.gcCount} collections, {result.gcTotalPauseMs ?? 0} ms
                  </Text>
                </View>
              )}
            </View>
          )}
          </>
        )}
      </Card.Content>
      <Card.Actions>
        <Button
          mode={status === "running" ? "contained-tonal" : "contained"}
          onPress={onRun}
          disabled={status === "running"}
        >
          {status === "running" ? "Running..." : "Run"}
        </Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  results: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
    backgroundColor: "#f0f0f005", // subtle bg
    padding: 8,
    borderRadius: 8,
  },
  metric: {
    alignItems: "center",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: "#666",
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "bold",
  },
  checkboxWrapper: {
    padding: 0,
    borderWidth: 1,
    borderRadius: 4,
    // width: 28, // Adjusted width
    // height: 28, // Adjusted height
    alignItems: "center",
    justifyContent: "center",
  },
});
