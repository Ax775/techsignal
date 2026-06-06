import { absolute, timeAgo } from '../lib/time';
import type { ChangeType, IntentSignal } from '../types';

interface SignalCardProps {
  signal: IntentSignal;
  onUnlock: (signal: IntentSignal) => void;
}

const TYPE_META: Record<ChangeType, { label: string; text: string; border: string }> = {
  churn: { label: 'Churn', text: 'text-red-400', border: 'border-l-red-500' },
  adoption: { label: 'Adoption', text: 'text-green-400', border: 'border-l-green-500' },
  vulnerability: {
    label: 'Vulnerability',
    text: 'text-amber-400',
    border: 'border-l-amber-500',
  },
};

export default function SignalCard({ signal, onUnlock }: SignalCardProps) {
  const meta = TYPE_META[signal.change_type];
  const locked = signal.status === 'locked';

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-l-2 border-slate-800 bg-slate-900/50 p-4 ${meta.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-100">
            {signal.domain ?? signal.company_name ?? 'unknown'}
          </p>
          <p className="mt-0.5 tabular truncate text-xs text-slate-500">
            {signal.tech_involved}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${meta.text}`}>
          {meta.label}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        {signal.description}
      </p>

      {locked ? (
        <button
          onClick={() => onUnlock(signal)}
          className="rounded-md border border-dashed border-slate-700 px-3 py-4 text-left text-xs text-slate-500 transition hover:border-slate-600 hover:text-slate-400"
        >
          Pitch unlocked after purchase — click to reveal
        </button>
      ) : (
        <p className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-300">
          {signal.generated_pitch}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <span
          className="tabular text-[11px] text-slate-500"
          title={absolute(signal.created_at)}
        >
          {timeAgo(signal.created_at)}
        </span>
        {locked ? (
          <div className="text-right">
            <span className="tabular text-sm font-medium text-slate-100">
              €{signal.price.toFixed(0)}
            </span>
            <span className="ml-1.5 text-[11px] text-slate-500">
              one-time, per signal
            </span>
          </div>
        ) : (
          <span className="text-xs text-emerald-400">Unlocked</span>
        )}
      </div>
    </div>
  );
}
