# UX/UI optimization — TechSignal dashboard

Baseline: a prior overhaul already removed gradients, neon glow, card-grids, generic
copy. This pass closes the remaining gaps against the spec.

## Plan

- [ ] **a11y groundwork** — `type="button"` on every non-submit button; `id`+`<label>`
  for every input; keyboard-focusable feed rows with visible focus ring.
- [ ] **Header** — monospace wordmark; drop empty subtitle; live scan-count that
  actually polls.
- [ ] **useCompanies** — silent background polling (30s) so the header count updates
  without flashing the table.
- [ ] **useSignals** — poll at 30s (was 15s); expose `updatedAt`.
- [ ] **LiveIntentFeed** — filter row as pill-tabs (distinct from section nav);
  drop decorative pulse on the fresh dot; rename headers to Change/Time;
  discrete "Updated HH:MM:SS" bottom-left; accurate empty-state copy.
- [ ] **CompanyTable** — inline add-form as a toolbar at the top of the table;
  status chips (Pending grey · Scanning blue pulsing dot · Done green check · Error red);
  labelled inputs; ghost "Scan now".
- [ ] **UnlockModal** — drop decorative check icons; placeholder
  "Any non-empty string unlocks"; primary CTA "Unlock pitch — €N"; larger readable pitch.
- [ ] **App** — stat row 4th metric → Avg signal value; `type` on tab buttons.
- [ ] **Delete SignalCard.tsx** — dead code, superseded by table + modal.
- [ ] Verify: `tsc --noEmit` clean, `npm run build` passes. Commit, push, deploy.

## Review

All items done. `tsc --noEmit` clean, `vite build` passes (173 kB JS / 53.7 kB gzip).

Files changed:
- `src/hooks/useSignals.ts` — 30s poll, exposes `updatedAt`.
- `src/hooks/useCompanies.ts` — silent 30s background poll (header count stays live,
  table never flashes "Loading…").
- `src/components/Header.tsx` — monospace wordmark, subtitle removed, live count.
- `src/components/LiveIntentFeed.tsx` — pill filters, keyboard-focusable rows with
  focus ring, Change/Time headers, "Updated HH:MM:SS" footer, accurate empty copy,
  decorative pulse dropped.
- `src/components/CompanyTable.tsx` — inline add toolbar, labelled inputs,
  `StatusChip` (pending/scanning/done/error), ghost actions, typed buttons.
- `src/components/UnlockModal.tsx` — decorative icons removed, honest placeholder,
  "Unlock pitch — €N" primary CTA, larger readable pitch.
- `src/App.tsx` — 4th stat → Avg signal value, typed tab buttons.
- `src/components/SignalCard.tsx` — deleted (dead code; superseded by table + modal).

Note: the spec's "blurred 60-char pitch preview" for the locked card couldn't be
honored literally — the API returns `generated_pitch: null` until unlock, so there is
no real text to blur. The card itself was unused; the locked→unlock flow lives in the
modal, where the value proposition is shown instead of a fake blur.
