import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { absolute, timeAgo } from '../lib/time';
import TechBadge from './TechBadge';
import type { Company, ScanStatus, TechCategory, TechStack } from '../types';

// Monospace state pills — the status reads like a log line, not a marketing badge.
const STATUS_STYLES: Record<ScanStatus, string> = {
  pending: 'text-slate-400',
  scanning: 'text-blue-400',
  done: 'text-emerald-400',
  error: 'text-red-400',
};

const CATEGORY_ORDER: TechCategory[] = [
  'ecommerce',
  'martech',
  'cms',
  'analytics',
  'infrastructure',
];

function flattenStack(stack: TechStack): { tech: string; category: TechCategory }[] {
  const out: { tech: string; category: TechCategory }[] = [];
  for (const cat of CATEGORY_ORDER) {
    for (const tech of stack[cat]) out.push({ tech, category: cat });
  }
  return out;
}

export default function CompanyTable() {
  const {
    companies,
    total,
    page,
    setPage,
    totalPages,
    setSearch,
    isLoading,
    error,
    busyId,
    addCompany,
    scanCompany,
    removeCompany,
  } = useCompanies();

  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      setFormError('Enter a domain to track.');
      return;
    }
    setAdding(true);
    setFormError(null);
    try {
      await addCompany(domain.trim(), name.trim() || undefined);
      setDomain('');
      setName('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add company.');
    } finally {
      setAdding(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      {/* Track new domain — its own section, separate from the data table. */}
      <section>
        <h2 className="text-sm font-medium text-slate-200">Track new domain</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          We snapshot the site and watch its stack for churn, adoption, and
          vulnerabilities.
        </p>
        <form
          onSubmit={handleAdd}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="tabular flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name (optional)"
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Track domain'}
          </button>
        </form>
        {formError && <p className="mt-2 text-xs text-red-400">{formError}</p>}
      </section>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Filter by domain or name…"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
        />
        <button
          type="submit"
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-4 pr-3 font-medium">Domain</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Tech stack</th>
                <th className="px-3 py-2.5 font-medium">Last scanned</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="py-2.5 pl-3 pr-4 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              ) : isLoading && companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Loading companies…
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="mx-auto max-w-sm rounded-md border border-dashed border-slate-700 px-6 py-8 text-center">
                      <p className="text-sm text-slate-300">
                        No domains tracked yet.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Add one above and we'll start watching its stack.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((co: Company) => {
                  const techs = flattenStack(co.current_tech_stack);
                  const shown = techs.slice(0, 3);
                  const extra = techs.length - shown.length;
                  const busy = busyId === co.id;
                  return (
                    <tr
                      key={co.id}
                      className="border-b border-slate-800/60 transition last:border-b-0 hover:bg-slate-800/40"
                    >
                      <td className="tabular py-3 pl-4 pr-3 font-medium text-slate-100">
                        {co.domain}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {co.company_name ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        {techs.length === 0 ? (
                          <span className="text-xs text-slate-600">
                            Nothing detected
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {shown.map((t) => (
                              <TechBadge
                                key={`${t.category}-${t.tech}`}
                                tech={t.tech}
                                category={t.category}
                              />
                            ))}
                            {extra > 0 && (
                              <span className="tabular text-[10px] text-slate-500">
                                +{extra} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {co.last_scanned_at ? (
                          <span
                            className="tabular text-xs text-slate-400"
                            title={absolute(co.last_scanned_at)}
                          >
                            {timeAgo(co.last_scanned_at)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">never</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`tabular text-xs ${STATUS_STYLES[co.scan_status]} ${
                            co.scan_status === 'scanning' ? 'animate-pulse' : ''
                          }`}
                        >
                          {co.scan_status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                        <button
                          onClick={() => scanCompany(co.id)}
                          disabled={busy}
                          className="text-xs font-medium text-blue-400 transition hover:text-blue-300 disabled:opacity-50"
                        >
                          {busy ? 'Working…' : 'Scan now'}
                        </button>
                        <button
                          onClick={() => removeCompany(co.id)}
                          disabled={busy}
                          className="ml-3 text-xs text-slate-500 transition hover:text-red-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
          <span className="tabular">
            {total.toLocaleString()} {total === 1 ? 'domain' : 'domains'} · page{' '}
            {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded border border-slate-700 p-1 transition hover:bg-slate-800 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded border border-slate-700 p-1 transition hover:bg-slate-800 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
