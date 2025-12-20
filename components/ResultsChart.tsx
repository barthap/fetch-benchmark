import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import type { Benchmark, BenchmarkResult } from "../benchmarks/types";

type ResultsChartProps = {
  benchmarks: Benchmark[];
  results: Record<string, BenchmarkResult>;
};

const PALETTE = [
  "#3366CC",
  "#DC3912",
  "#FF9900",
  "#109618",
  "#990099",
  "#0099C6",
  "#DD4477",
  "#66AA00",
  "#B82E2E",
  "#316395",
];

export const ResultsChart = ({ benchmarks, results }: ResultsChartProps) => {
  const completedResults = Object.entries(results)
    .map(([id, result]) => {
      const benchmark = benchmarks.find((b) => b.id === id);
      return {
        id,
        name: benchmark?.name || "Unknown",
        duration: result.durationMs,
      };
    })
    .filter((r) => r.duration > 0)
    .sort((a, b) => a.duration - b.duration);

  if (completedResults.length === 0) {
    return null;
  }

  const maxDuration = Math.max(...completedResults.map((r) => r.duration));

  return (
    <Card style={styles.card}>
      <Card.Title title="Benchmark Results" />
      <Card.Content>
        <View style={styles.chart}>
          {completedResults.map((result, index) => {
            const width = (result.duration / maxDuration) * 100;
            const color = PALETTE[index % PALETTE.length];

            return (
              <View key={result.id} style={styles.barContainer}>
                <Text style={styles.barLabel}>{result.name}</Text>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${width}%`,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{result.duration.toFixed(2)} ms</Text>
              </View>
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  chart: {
    gap: 10,
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    width: 80,
    fontSize: 12,
  },
  barWrapper: {
    flex: 1,
    height: 12,
    backgroundColor: "#eee",
    borderRadius: 6,
  },
  bar: {
    height: 12,
    borderRadius: 6,
  },
  barValue: {
    width: 60,
    fontSize: 12,
    textAlign: "right",
  },
});
