import { useSignals } from '../hooks/useSignals';
import { absolute, isFresh, timeAgo } from '../lib/time';
import type { ChangeType, IntentSignal } from '../types';

interface LiveIntentFeedProps {
  onSelect: (signal: IntentSignal) => void;
}

// Each change type carries its own meaning, so each gets its own color.
// The left border is the signal — red reads as churn before you read a word.
const TYPE_META: Record<
  ChangeType,
  { label: string; row: string; text: string }
> = {
  churn: {
    label: 'Churn',
    row: 'border-l-red-500 hover:bg-red-950/30',
    text: 'text-red-400',
  },
  adoption: {
    label: 'Adoption',
    row: 'border-l-green-500 hover:bg-green-950/30',
    text: 'text-green-400',
  },
  vulnerability: {
    label: 'Vulnerability',
    row: 'border-l-amber-500 hover:bg-amber-950/30',
    text: 'text-amber-400',
  },
};

const FILTERS: { key: 'all' | ChangeType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'churn', label: 'Churn' },
  { key: 'adoption', label: 'Adoption' },
  { key: 'vulnerability', label: 'Vulnerability' },
];

export default function LiveIntentFeed({ onSelect }: LiveIntentFeedProps) {
  const { signals, isLoading, error, filters, setFilters } = useSignals();
  const active = filters.type ?? 'all';

  return (
    <section>
      {/* Filter tabs — plain text, not colored pills. */}
      <div className="mb-3 flex items-center gap-5 border-b border-slate-800/80">
        {FILTERS.map((f) => {
          const selected = active === f.key;
          return (
            <button
              key={f.key}
              onClick={() =>
                setFilters({
                  ...filters,
                  type: f.key === 'all' ? undefined : f.key,
                })
              }
              className={`-mb-px border-b-2 pb-2 text-sm transition ${
                selected
                  ? 'border-blue-500 font-medium text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        {isLoading && signals.length === 0 ? (
          <LoadingRows />
        ) : error ? (
          <div className="px-4 py-12 text-center text-sm text-red-400">
            {error}
          </div>
        ) : signals.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-4 pr-3 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Tech</th>
                <th className="px-3 py-2.5 font-medium">Signal</th>
                <th className="px-3 py-2.5 text-right font-medium">When</th>
                <th className="py-2.5 pl-3 pr-4 text-right font-medium">
                  {/* action column */}
                </th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => {
                const meta = TYPE_META[s.change_type];
                const fresh = isFresh(s.created_at);
                const unlocked = s.status === 'unlocked';
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s)}
                    className={`cursor-pointer border-l-2 border-b border-slate-800/60 transition last:border-b-0 ${meta.row}`}
                  >
                    <td className="py-3 pl-4 pr-3 align-top">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            fresh ? `animate-pulse ${dotColor(s.change_type)}` : 'bg-slate-600'
                          }`}
                          title={fresh ? 'New in the last 2 minutes' : undefined}
                          aria-hidden
                        />
                        <span className="font-medium text-slate-100">
                          {s.domain ?? s.company_name ?? 'unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="tabular text-xs text-slate-400">
                        {s.tech_involved}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`text-xs font-medium ${meta.text}`}>
                        {meta.label}
                      </span>
                      <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                        {s.description}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                      <span
                        className="tabular text-xs text-slate-500"
                        title={absolute(s.created_at)}
                      >
                        {timeAgo(s.created_at)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right align-top">
                      {unlocked ? (
                        <span className="text-xs text-emerald-400">Unlocked</span>
                      ) : (
                        <span className="tabular text-xs text-slate-400">
                          €{s.price.toFixed(0)}
                          <span className="ml-1 text-slate-600">unlock →</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function dotColor(type: ChangeType): string {
  if (type === 'churn') return 'bg-red-500';
  if (type === 'adoption') return 'bg-green-500';
  return 'bg-amber-500';
}

function LoadingRows() {
  // Skeleton rows that match the real row height, so the layout doesn't jump.
  return (
    <div className="divide-y divide-slate-800/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-20 animate-pulse rounded bg-slate-800/70" />
          <div className="h-3 flex-1 animate-pulse rounded bg-slate-800/50" />
          <div className="h-3 w-12 animate-pulse rounded bg-slate-800/70" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="m-4 rounded-md border border-dashed border-slate-700 px-6 py-12 text-center">
      <p className="text-sm text-slate-300">No signals detected yet.</p>
      <p className="mt-1 text-xs text-slate-500">
        Add companies to start tracking their tech stack for change.
      </p>
    </div>
  );
}
