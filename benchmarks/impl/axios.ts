import axios from 'axios';
import { Benchmark, BenchmarkResult } from '../types';
import { calculateThroughput } from '../utils';

export const axiosBenchmark: Benchmark = {
  id: 'axios',
  name: 'Axios',
  description: 'Uses Axios library with responseType: "blob".',
  run: async (url: string): Promise<BenchmarkResult> => {
    const start = Date.now();
    try {
        const response = await axios.get(url, { responseType: 'blob' });
        const end = Date.now();
        
        const durationMs = end - start;
        // In RN, axios with blob responseType returns a Blob object (if polyfilled) or similar
        // Let's assume standard behavior or fallback to data length
        const sizeBytes = response.data.size || response.data.length || 0;
        
        return {
            durationMs,
            sizeBytes,
            throughputMbPerCc: calculateThroughput(sizeBytes, durationMs),
            statusCode: response.status,
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
  },
};
