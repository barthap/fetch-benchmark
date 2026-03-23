import { StyleSheet, View, Pressable } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { MetricInfo } from "../benchmarks/metrics";

interface Props {
  metrics: MetricInfo[];
  selected: string;
  onSelect: (key: string) => void;
}

export function MetricSelector({ metrics, selected, onSelect }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {metrics.map((m) => {
        const isActive = m.key === selected;
        return (
          <Pressable
            key={m.key}
            onPress={() => onSelect(m.key)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isActive
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
  },
});
