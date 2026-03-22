// components/BenchmarkCard.tsx
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Checkbox, Text, useTheme } from "react-native-paper";
import type { Implementation } from "../benchmarks/implementation";
import type { BenchmarkResult, MultiRunResult } from "../benchmarks/types";
import { METRICS, getMetricValue } from "../benchmarks/metrics";

interface RunningState {
  implId: string;
  runIndex: number;
  runCount: number;
}

interface Props {
  testId: string;
  testName: string;
  testDescription: string;
  implementations: Implementation[];
  results: Record<string, MultiRunResult | undefined>; // keyed by impl.id
  isSelected: boolean;
  onToggle: () => void;
  runningState: RunningState | null;
  hasAnyResult: boolean;
}

export function BenchmarkCard({
  testName,
  testDescription,
  implementations,
  results,
  isSelected,
  onToggle,
  runningState,
  hasAnyResult,
}: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Determine status label
  let statusText = "";
  let statusColor = theme.colors.outline;
  if (runningState) {
    const impl = implementations.find((i) => i.id === runningState.implId);
    statusText = `● ${impl?.shortLabel ?? "?"} ${runningState.runIndex}/${runningState.runCount}…`;
    statusColor = "#f39c12";
  } else if (hasAnyResult) {
    statusText = "Done";
    statusColor = "#2ecc71";
  }

  // Determine which metrics have data in any result
  const implsWithResults = implementations.filter(
    (impl) => results[impl.id]?.median,
  );
  const availableMetrics = METRICS.filter((m) =>
    implsWithResults.some((impl) => {
      const val = getMetricValue(
        results[impl.id]!.median as Record<string, unknown>,
        m.key,
      );
      return val !== undefined;
    }),
  );

  // Find best value per metric row
  function getBestImplId(metricKey: string, higherIsBetter: boolean): string | null {
    let bestId: string | null = null;
    let bestVal: number | undefined;
    for (const impl of implsWithResults) {
      const val = getMetricValue(
        results[impl.id]!.median as Record<string, unknown>,
        metricKey,
      );
      if (val === undefined) continue;
      if (
        bestVal === undefined ||
        (higherIsBetter ? val > bestVal : val < bestVal)
      ) {
        bestVal = val;
        bestId = impl.id;
      }
    }
    return bestId;
  }

  return (
    <Card
      style={[
        styles.card,
        runningState && { borderColor: "#f39c12", borderWidth: 1 },
      ]}
    >
      <Pressable
        onPress={() => hasAnyResult && setExpanded(!expanded)}
        style={styles.header}
      >
        <Checkbox
          status={isSelected ? "checked" : "unchecked"}
          onPress={onToggle}
          color={theme.colors.primary}
        />
        <View style={styles.titleBlock}>
          <Text variant="titleSmall">{testName}</Text>
          {testDescription ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.outline }}
            >
              {testDescription}
            </Text>
          ) : null}
        </View>
        {statusText ? (
          <Text style={[styles.status, { color: statusColor }]}>
            {statusText}
          </Text>
        ) : null}
        {hasAnyResult && (
          <Text style={{ color: theme.colors.outline, fontSize: 14 }}>
            {expanded ? "▲" : "▼"}
          </Text>
        )}
      </Pressable>

      {expanded && implsWithResults.length > 0 && (
        <View style={styles.tableContainer}>
          {/* Header row: impl columns */}
          <View style={styles.tableRow}>
            <View style={styles.metricLabelCell} />
            {implsWithResults.map((impl) => (
              <View key={impl.id} style={styles.valueCell}>
                <View
                  style={[styles.dot, { backgroundColor: impl.color }]}
                />
                <Text style={styles.colHeader}>{impl.shortLabel}</Text>
              </View>
            ))}
          </View>

          {/* Metric rows */}
          {availableMetrics.map((metric, idx) => {
            const bestId = getBestImplId(metric.key, metric.higherIsBetter);
            return (
              <View
                key={metric.key}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 && styles.altRow,
                ]}
              >
                <View style={styles.metricLabelCell}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>
                {implsWithResults.map((impl) => {
                  const val = getMetricValue(
                    results[impl.id]!.median as Record<string, unknown>,
                    metric.key,
                  );
                  const isBest = impl.id === bestId && implsWithResults.length > 1;
                  return (
                    <View key={impl.id} style={styles.valueCell}>
                      <Text
                        style={[
                          styles.metricValue,
                          isBest && styles.bestValue,
                        ]}
                      >
                        {val !== undefined ? metric.format(val) : "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 6,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  titleBlock: {
    flex: 1,
  },
  status: {
    fontSize: 10,
  },
  tableContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  altRow: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  metricLabelCell: {
    width: 55,
  },
  metricLabel: {
    fontSize: 11,
    color: "#888",
  },
  valueCell: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: "600",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricValue: {
    fontSize: 11,
    textAlign: "right",
  },
  bestValue: {
    color: "#2ecc71",
    fontWeight: "bold",
  },
});
