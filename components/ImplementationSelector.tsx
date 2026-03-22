import { StyleSheet, View } from "react-native";
import { Checkbox, Text, useTheme } from "react-native-paper";
import type { Implementation } from "../benchmarks/implementation";

interface Props {
  implementations: Implementation[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function ImplementationSelector({
  implementations,
  selected,
  onToggle,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text
        variant="labelSmall"
        style={[styles.label, { color: theme.colors.outline }]}
      >
        IMPLEMENTATIONS
      </Text>
      <View style={styles.row}>
        {implementations.map((impl) => (
          <View key={impl.id} style={styles.item}>
            <Checkbox
              status={
                !impl.enabled
                  ? "unchecked"
                  : selected.has(impl.id)
                    ? "checked"
                    : "unchecked"
              }
              onPress={() => impl.enabled && onToggle(impl.id)}
              disabled={!impl.enabled}
              color={impl.color}
            />
            <View
              style={[styles.dot, { backgroundColor: impl.color }]}
            />
            <Text
              style={[
                styles.implLabel,
                !impl.enabled && { color: theme.colors.outline },
              ]}
            >
              {impl.shortLabel}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  implLabel: {
    fontSize: 13,
  },
});
