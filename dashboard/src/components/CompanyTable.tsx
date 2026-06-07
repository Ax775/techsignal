import { useState, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { absolute, timeAgo } from '../lib/time';
import TechBadge from './TechBadge';
import type { Company, ScanStatus, TechCategory, TechStack } from '../types';

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
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-slate-200">Tracked domains</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          We snapshot each site and watch its stack for churn, adoption, and
          vulnerabilities.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-800">
        {/* Toolbar — add a domain inline, filter the list, all at the top of the table. */}
        <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/30 p-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="add-domain" className="sr-only">
                Domain to track
              </label>
              <input
                id="add-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="tabular w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 sm:w-44"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="add-name" className="sr-only">
                Company name (optional)
              </label>
              <input
                id="add-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company name (optional)"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 sm:w-52"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
            >
              {adding ? 'Adding…' : 'Track domain'}
            </button>
          </form>

          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <label htmlFor="company-search" className="sr-only">
              Filter domains
            </label>
            <input
              id="company-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by domain or name…"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 sm:w-56"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              Search
            </button>
          </form>
        </div>
        {formError && (
          <p className="border-b border-slate-800 bg-red-950/20 px-4 py-2 text-xs text-red-400">
            {formError}
          </p>
        )}

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
                        <StatusChip status={co.scan_status} />
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => scanCompany(co.id)}
                          disabled={busy}
                          className="rounded text-xs font-medium text-blue-400 transition hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50"
                        >
                          {busy ? 'Working…' : 'Scan now'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCompany(co.id)}
                          disabled={busy}
                          className="ml-3 rounded text-xs text-slate-500 transition hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50"
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
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded border border-slate-700 p-1 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded border border-slate-700 p-1 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-40"
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

// Three states the user actually cares about, plus error. The dot pulses only
// while a scan is in flight — the one place motion means "work is happening".
function StatusChip({ status }: { status: ScanStatus }) {
  if (status === 'done') {
    return (
      <span className="tabular inline-flex items-center gap-1 text-xs text-emerald-400">
        <Check className="h-3.5 w-3.5" aria-hidden />
        done
      </span>
    );
  }
  if (status === 'scanning') {
    return (
      <span className="tabular inline-flex items-center gap-1.5 text-xs text-blue-400">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400"
          aria-hidden
        />
        scanning
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="tabular inline-flex items-center gap-1.5 text-xs text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
        error
      </span>
    );
  }
  return (
    <span className="tabular inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden />
      pending
    </span>
  );
}
