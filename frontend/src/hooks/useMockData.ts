import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';

// ─── Mock Data Flag ──────────────────────────────────────────────────
const FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true';

// ─── Types ───────────────────────────────────────────────────────────

export interface SystemHealth {
  status: string;
  uptime_hours: number;
  api_latency_ms: number;
  model_status: string;
  active_models: number;
  circuit_breaker: string;
}

export interface FraudAlert {
  id: string;
  user_id: string;
  risk_score: number;
  type: string;
  amount: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'investigating' | 'resolved' | 'escalated';
  region: string;
}

export interface CreditMetric {
  total_scored: number;
  approved_rate: number;
  avg_score: number;
  unbanked_served: number;
  inclusion_index: number;
  adverse_notices_sent: number;
}

export interface TransactionEvent {
  id: string;
  user_id: string;
  merchant: string;
  amount: number;
  category: string;
  risk_score: number;
  is_fraud: boolean;
  timestamp: string;
}

export interface ConsortiumNode {
  bank_id: string;
  name: string;
  status: 'online' | 'training' | 'offline';
  fraud_rate: number;
  last_sync: string;
}

// ─── Mock Data Generators ────────────────────────────────────────────

export const MOCK_SYSTEM_HEALTH: SystemHealth = {
  status: 'operational',
  uptime_hours: 2_847,
  api_latency_ms: 12.4,
  model_status: 'all_healthy',
  active_models: 5,
  circuit_breaker: 'closed',
};

export const MOCK_FRAUD_ALERTS: FraudAlert[] = [
  { id: 'FA-001', user_id: 'USR-IN-7a4f', risk_score: 94, type: 'smurfing', amount: 9_450, currency: 'USD', timestamp: new Date().toISOString(), status: 'pending', region: 'ap-south-1' },
  { id: 'FA-002', user_id: 'USR-EU-3b2c', risk_score: 87, type: 'layering', amount: 24_800, currency: 'EUR', timestamp: new Date(Date.now() - 300_000).toISOString(), status: 'investigating', region: 'eu-west-1' },
  { id: 'FA-003', user_id: 'USR-US-9d1e', risk_score: 72, type: 'card_testing', amount: 4.99, currency: 'USD', timestamp: new Date(Date.now() - 900_000).toISOString(), status: 'escalated', region: 'us-east-1' },
  { id: 'FA-004', user_id: 'USR-AP-5f8a', risk_score: 68, type: 'velocity', amount: 3_200, currency: 'SGD', timestamp: new Date(Date.now() - 1_800_000).toISOString(), status: 'resolved', region: 'ap-southeast-1' },
  { id: 'FA-005', user_id: 'USR-IN-2c9b', risk_score: 91, type: 'bust_out', amount: 45_000, currency: 'INR', timestamp: new Date(Date.now() - 120_000).toISOString(), status: 'pending', region: 'ap-south-1' },
];

export const MOCK_CREDIT_METRICS: CreditMetric = {
  total_scored: 142_853,
  approved_rate: 0.734,
  avg_score: 628,
  unbanked_served: 38_491,
  inclusion_index: 0.892,
  adverse_notices_sent: 1_247,
};

export const MOCK_TRANSACTIONS: TransactionEvent[] = Array.from({ length: 20 }, (_, i) => ({
  id: `TX-${String(i + 1).padStart(4, '0')}`,
  user_id: `USR-${['IN', 'EU', 'US', 'AP'][i % 4]}-${Math.random().toString(36).slice(2, 6)}`,
  merchant: ['Amazon', 'Uber', 'Netflix', 'Walmart', 'Starbucks', 'Zomato', 'PhonePe', 'PayPal'][i % 8],
  amount: Math.round((Math.random() * 500 + 5) * 100) / 100,
  category: ['grocery', 'transport', 'subscription', 'retail', 'food', 'p2p', 'utility'][i % 7],
  risk_score: Math.round(Math.random() * 100),
  is_fraud: i === 3 || i === 11,
  timestamp: new Date(Date.now() - i * 45_000).toISOString(),
}));

export const MOCK_CONSORTIUM: ConsortiumNode[] = [
  { bank_id: 'bank-a', name: 'First National Bank', status: 'online', fraud_rate: 0.012, last_sync: new Date().toISOString() },
  { bank_id: 'bank-b', name: 'Global Commerce Bank', status: 'training', fraud_rate: 0.008, last_sync: new Date(Date.now() - 600_000).toISOString() },
  { bank_id: 'bank-c', name: 'Pacific Microfinance', status: 'online', fraud_rate: 0.015, last_sync: new Date(Date.now() - 300_000).toISOString() },
];

// ─── Generic Mock Data Hook ──────────────────────────────────────────

export function useMockData<T>(
  endpoint: string,
  mockData: T,
  options?: { pollInterval?: number; enabled?: boolean; normalize?: (value: unknown) => T }
): { data: T | null; isLoading: boolean; isMocked: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(mockData);
  const [isLoading, setIsLoading] = useState(true);
  const [isMocked, setIsMocked] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (FORCE_MOCK) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
      setData(mockData);
      setIsMocked(true);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      const json = await apiGet<unknown>(endpoint);
      setData(options?.normalize ? options.normalize(json) : json as T);
      setIsMocked(false);
      setError(null);
    } catch (err) {
      // Fallback to mock on failure
      setData(mockData);
      setIsMocked(true);
      setError(err instanceof Error ? err.message : 'Unable to load live data');
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, mockData, options?.normalize]);

  useEffect(() => {
    if (options?.enabled === false) return;
    fetchData();

    if (options?.pollInterval) {
      const id = setInterval(fetchData, options.pollInterval);
      return () => clearInterval(id);
    }
  }, [fetchData, options?.pollInterval, options?.enabled]);

  return { data, isLoading, isMocked, error, refetch: fetchData };
}
