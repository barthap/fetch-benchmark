import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { Implementation, TestDefinition, ResultsMap } from "../benchmarks/implementation";
import type { BenchmarkResult } from "../benchmarks/types";
import { getMetricInfo, getMetricValue } from "../benchmarks/metrics";

interface Props {
  tests: TestDefinition<any>[];
  implementations: Implementation[];
  results: ResultsMap;
  metricKey: string;
}

export function ResultsChartGroup({
  tests,
  implementations,
  results,
  metricKey,
}: Props) {
  const theme = useTheme();
  const metricInfo = getMetricInfo(metricKey);
  if (!metricInfo) return null;

  // Collect all values to find global max for bar scaling
  let globalMax = 0;
  for (const test of tests) {
    for (const impl of implementations) {
      const result = results[impl.id]?.[test.id]?.median;
      if (result) {
        const val = getMetricValue(result as Record<string, unknown>, metricKey);
        if (val !== undefined && Math.abs(val) > globalMax) {
          globalMax = Math.abs(val);
        }
      }
    }
  }

  if (globalMax === 0) return null;

  // Filter to tests that have at least one result
  const testsWithResults = tests.filter((test) =>
    implementations.some(
      (impl) =>
        results[impl.id]?.[test.id]?.median &&
        getMetricValue(
          results[impl.id][test.id].median as Record<string, unknown>,
          metricKey,
        ) !== undefined,
    ),
  );

  if (testsWithResults.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text
        variant="labelSmall"
        style={[styles.sectionLabel, { color: theme.colors.primary }]}
      >
        Results — {metricInfo.label}
      </Text>
      {testsWithResults.map((test) => (
        <View key={test.id} style={styles.testGroup}>
          <Text variant="labelMedium" style={styles.testName}>
            {test.name}
          </Text>
          {implementations.map((impl) => {
            const result = results[impl.id]?.[test.id]?.median;
            if (!result) return null;
            const val = getMetricValue(
              result as Record<string, unknown>,
              metricKey,
            );
            if (val === undefined) return null;

            const barWidth = (Math.abs(val) / globalMax) * 100;
            return (
              <View key={impl.id} style={styles.barRow}>
                <Text style={[styles.implLabel, { fontFamily: "monospace" }]}>
                  {impl.shortLabel}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: impl.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>
                  {metricInfo.format(val)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionLabel: {
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  testGroup: {
    marginBottom: 14,
  },
  testName: {
    marginBottom: 5,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  implLabel: {
    fontSize: 10,
    width: 55,
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  bar: {
    height: 12,
    borderRadius: 2,
  },
  barValue: {
    fontSize: 10,
    width: 65,
    textAlign: "right",
  },
});
