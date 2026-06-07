import { useCompanies } from '../hooks/useCompanies';

export default function Header() {
  // The status badge reflects how many domains we're actively monitoring.
  const { total: targets } = useCompanies();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <h1 className="font-mono text-[15px] font-semibold tracking-tight text-white">
          techsignal
        </h1>

        <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          <span className="tabular text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Watching <span className="text-slate-200">{targets}</span>{' '}
            {targets === 1 ? 'domain' : 'domains'}
          </span>
        </div>
      </div>
    </header>
  );
}
