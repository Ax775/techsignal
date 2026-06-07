import { useCallback, useEffect, useRef, useState } from 'react';
import { getSignals } from '../api/client';
import type { ChangeType, IntentSignal, SignalStatus } from '../types';

export interface SignalFilterState {
  type?: ChangeType;
  status?: SignalStatus;
}

const POLL_MS = 30_000;

export function useSignals(initial: SignalFilterState = {}) {
  const [signals, setSignals] = useState<IntentSignal[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filters, setFilters] = useState<SignalFilterState>(initial);

  // Keep latest filters in a ref so the polling interval always reads current.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchOnce = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true);
    try {
      const f = filtersRef.current;
      const res = await getSignals({
        change_type: f.type,
        status: f.status,
        limit: 50,
      });
      setSignals(res.data);
      setTotal(res.total);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signals');
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchOnce(true), [fetchOnce]);

  // Refetch with spinner whenever filters change.
  useEffect(() => {
    void fetchOnce(true);
  }, [fetchOnce, filters.type, filters.status]);

  // Background poll without spinner.
  useEffect(() => {
    const id = window.setInterval(() => void fetchOnce(false), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchOnce]);

  return {
    signals,
    total,
    isLoading,
    error,
    updatedAt,
    refetch,
    filters,
    setFilters,
  };
}
