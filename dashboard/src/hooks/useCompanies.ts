import { useCallback, useEffect, useState } from 'react';
import {
  addCompany as apiAddCompany,
  getCompanies,
  scanCompany as apiScanCompany,
  deleteCompany as apiDeleteCompany,
} from '../api/client';
import type { Company } from '../types';

const PAGE_SIZE = 20;

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getCompanies({ page, limit: PAGE_SIZE, search });
      setCompanies(res.data);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  const addCompany = useCallback(
    async (domain: string, name?: string) => {
      await apiAddCompany(domain, name);
      setPage(1);
      await fetchCompanies();
    },
    [fetchCompanies],
  );

  const scanCompany = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await apiScanCompany(id);
        await fetchCompanies();
      } finally {
        setBusyId(null);
      }
    },
    [fetchCompanies],
  );

  const removeCompany = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await apiDeleteCompany(id);
        await fetchCompanies();
      } finally {
        setBusyId(null);
      }
    },
    [fetchCompanies],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    companies,
    total,
    page,
    setPage,
    totalPages,
    search,
    setSearch,
    isLoading,
    error,
    busyId,
    refetch: fetchCompanies,
    addCompany,
    scanCompany,
    removeCompany,
  };
}
