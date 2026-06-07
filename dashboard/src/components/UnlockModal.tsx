import { useEffect, useState } from 'react';
import { X, Copy } from 'lucide-react';
import { createCheckoutSession } from '../api/client';
import { absolute, timeAgo } from '../lib/time';
import type { ChangeType, IntentSignal } from '../types';

interface UnlockModalProps {
  signal: IntentSignal | null;
  onClose: () => void;
}

const TYPE_TEXT: Record<ChangeType, string> = {
  churn: 'text-red-400',
  adoption: 'text-green-400',
  vulnerability: 'text-amber-400',
};

const TYPE_LABEL: Record<ChangeType, string> = {
  churn: 'Churn',
  adoption: 'Adoption',
  vulnerability: 'Vulnerability',
};

export default function UnlockModal({ signal, onClose }: UnlockModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset internal state whenever the target signal changes.
  useEffect(() => {
    setSubmitting(false);
    setError(null);
    setCopied(false);
  }, [signal?.id]);

  // Escape to close.
  useEffect(() => {
    if (!signal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signal, onClose]);

  if (!signal) return null;

  const view = signal;
  const isUnlocked = view.status === 'unlocked';

  // Create a Stripe Checkout Session and hand the browser off to Stripe's
  // hosted payment page. On success Stripe redirects back to
  // /unlock/success?session_id=… where App picks up the result.
  const handleCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await createCheckoutSession(signal.id);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setSubmitting(false);
    }
    // On success the browser navigates away, so we deliberately leave
    // `submitting` true to keep the button disabled during the redirect.
  };

  const handleCopy = async () => {
    if (!view.generated_pitch) return;
    try {
      await navigator.clipboard.writeText(view.generated_pitch);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore silently.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <h3 className="text-sm font-medium text-slate-100">Signal detail</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-0 sm:grid-cols-2">
          {/* Left: signal details */}
          <div className="space-y-4 border-b border-slate-800 px-5 py-5 sm:border-b-0 sm:border-r">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Company
              </p>
              <p className="mt-0.5 font-medium text-slate-100">
                {view.domain ?? view.company_name ?? 'unknown'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Signal
                </p>
                <p
                  className={`mt-0.5 text-sm font-medium ${TYPE_TEXT[view.change_type]}`}
                >
                  {TYPE_LABEL[view.change_type]}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Detected
                </p>
                <p
                  className="tabular mt-0.5 text-sm text-slate-300"
                  title={absolute(view.created_at)}
                >
                  {timeAgo(view.created_at)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Tech involved
              </p>
              <p className="tabular mt-0.5 text-sm text-slate-300">
                {view.tech_involved}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                What happened
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-400">
                {view.description}
              </p>
            </div>
          </div>

          {/* Right: unlock form, or the revealed pitch */}
          <div className="px-5 py-5">
            {!isUnlocked ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-300">
                    Unlock to get
                  </p>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-400">
                    <li>A full personalized cold-email pitch, ready to send</li>
                    <li>Decision-maker intent and timing context</li>
                    <li>The exact tech change that triggered the signal</li>
                  </ul>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                >
                  {submitting
                    ? 'Redirecting to checkout…'
                    : `Unlock for €${view.price.toFixed(0)}`}
                </button>
                <p className="tabular text-center text-[11px] text-slate-500">
                  Secure one-time payment via Stripe
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-emerald-400">
                  Unlocked — ready to send.
                </p>
                <div className="rounded-md border border-slate-800 bg-slate-950/60">
                  <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      Email template
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words px-4 py-4 font-sans text-sm leading-relaxed text-slate-100">
                    {view.generated_pitch ?? 'No pitch available for this signal.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
