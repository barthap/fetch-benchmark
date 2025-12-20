import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { Benchmark, BenchmarkResult, BenchmarkStatus } from '../benchmarks/types';
import { formatBytes } from '../benchmarks/utils';

interface Props {
  benchmark: Benchmark;
  status: BenchmarkStatus;
  result?: BenchmarkResult;
  onRun: () => void;
}

export function BenchmarkCard({ benchmark, status, result, onRun }: Props) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
            <View style={{ flex: 1 }}>
                <Text variant="titleMedium">{benchmark.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {benchmark.description}
                </Text>
            </View>
            {status === 'running' && <ActivityIndicator animating={true} size="small" />}
        </View>

        {status === 'error' && result?.error && (
            <Text style={{ color: theme.colors.error, marginTop: 8 }}>
                Error: {result.error}
            </Text>
        )}

        {status === 'success' && result && (
            <View style={styles.results}>
                <View style={styles.metric}>
                    <Text variant="labelSmall">Time</Text>
                    <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>{result.durationMs} ms</Text>
                </View>
                <View style={styles.metric}>
                    <Text variant="labelSmall">Size</Text>
                    <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>{formatBytes(result.sizeBytes)}</Text>
                </View>
                {result.throughputMbPerCc !== undefined && (
                    <View style={styles.metric}>
                        <Text variant="labelSmall">Speed</Text>
                        <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>{result.throughputMbPerCc.toFixed(2)} MB/s</Text>
                    </View>
                )}
            </View>
        )}
      </Card.Content>
      <Card.Actions>
        <Button 
            mode={status === 'running' ? "contained-tonal" : "contained"} 
            onPress={onRun}
            disabled={status === 'running'}
        >
          {status === 'running' ? 'Running...' : 'Run'}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  results: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: '#f0f0f005', // subtle bg
    padding: 8,
    borderRadius: 8,
  },
  metric: {
    alignItems: 'center',
  },
});
