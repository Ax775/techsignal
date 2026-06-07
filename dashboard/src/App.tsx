import { useEffect, useState } from 'react';
import Header from './components/Header';
import LiveIntentFeed from './components/LiveIntentFeed';
import CompanyTable from './components/CompanyTable';
import UnlockModal from './components/UnlockModal';
import { useSignals } from './hooks/useSignals';
import { getLogs } from './api/client';
import { absolute } from './lib/time';
import type { IntentSignal, SystemLog } from './types';

type Tab = 'feed' | 'companies' | 'logs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'feed', label: 'Intent Feed' },
  { key: 'companies', label: 'Companies' },
  { key: 'logs', label: 'Logs' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('feed');
  const [selected, setSelected] = useState<IntentSignal | null>(null);

  // App-level (unfiltered) signal stream powers the headline stat row.
  const { signals, total } = useSignals();
  const churn = signals.filter((s) => s.change_type === 'churn').length;
  const adoption = signals.filter((s) => s.change_type === 'adoption').length;
  const avgValue = signals.length
    ? Math.round(
        signals.reduce((sum, s) => sum + s.price, 0) / signals.length,
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Tabs — plain text navigation, active tab underlined. */}
        <nav className="mb-6 flex items-center gap-6 border-b border-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 pb-2.5 text-sm transition ${
                tab === t.key
                  ? 'border-blue-500 font-medium text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'feed' && (
          <div className="space-y-4">
            {/* Headline stats — a thin row of numbers, not a grid of cards. */}
            <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
              <Stat n={total} label="signals" tone="text-slate-100" />
              <Sep />
              <Stat n={churn} label="churn" tone="text-red-400" />
              <Sep />
              <Stat n={adoption} label="adoption" tone="text-green-400" />
              <Sep />
              <span>
                <span className="tabular text-slate-100">€{avgValue}</span>{' '}
                <span className="text-slate-500">avg value</span>
              </span>
            </p>
            <LiveIntentFeed onSelect={setSelected} />
          </div>
        )}

        {tab === 'companies' && <CompanyTable />}

        {tab === 'logs' && <LogsPanel />}
      </main>

      <UnlockModal
        signal={selected}
        onClose={() => setSelected(null)}
        onUnlocked={(s) => setSelected(s)}
      />
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span>
      <span className={tone}>{n.toLocaleString()}</span>{' '}
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

function Sep() {
  return <span className="text-slate-700">·</span>;
}

const LEVEL_STYLES: Record<SystemLog['level'], string> = {
  info: 'text-slate-400',
  success: 'text-green-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

function LogsPanel() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getLogs(100);
        if (!cancelled) {
          setLogs(res.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load logs');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    const id = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="overflow-x-auto">
        {error ? (
          <p className="px-4 py-10 text-center text-sm text-red-400">{error}</p>
        ) : isLoading && logs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Loading logs…
          </p>
        ) : logs.length === 0 ? (
          <div className="m-4 rounded-md border border-dashed border-slate-700 px-6 py-10 text-center">
            <p className="text-sm text-slate-300">No events logged yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Scans and unlocks will show up here as they happen.
            </p>
          </div>
        ) : (
          <table className="min-w-full font-mono text-xs leading-relaxed">
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-slate-900 last:border-b-0 hover:bg-slate-900/50"
                >
                  <td
                    className="whitespace-nowrap py-1.5 pl-4 pr-3 text-slate-500"
                    title={absolute(log.ts)}
                  >
                    {compactTs(log.ts)}
                  </td>
                  <td
                    className={`py-1.5 pr-3 uppercase ${LEVEL_STYLES[log.level]}`}
                  >
                    {log.level.padEnd(7)}
                  </td>
                  <td className="py-1.5 pr-4 text-slate-300">
                    {log.event}
                    {log.payload ? (
                      <span className="text-slate-600"> {log.payload}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function compactTs(raw: string): string {
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
