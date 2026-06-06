# TechSignal dashboard — human-first redesign

## Plan
- [ ] `src/index.css` — Inter + JetBrains Mono import, `.tabular` util, drop neon/gradient/radar/blur clichés, Inter as base font
- [ ] `tailwind.config.ts` — register Inter (sans) + JetBrains Mono (mono); drop radar/pulse-ring + neon shadows
- [ ] `components/Header.tsx` — plain white wordmark, thin uppercase label, "SCANNING N TARGETS" badge from useCompanies
- [ ] `components/LiveIntentFeed.tsx` — real table layout, relative time w/ absolute on hover, left-border type colors, text-tabs, honest empty state, pulse only on fresh dot
- [ ] `components/SignalCard.tsx` — dashed locked-pitch box (no blur), €49 + one-time sub-label
- [ ] `components/UnlockModal.tsx` — 2-col layout, no gradient, "Reference code" + hint, "Unlock signal →", inline success pitch + copy
- [ ] `components/CompanyTable.tsx` — separate "Track new domain" section, mono scan-status badge, relative last-scanned, max 3 tech + "+N more", text-link Scan Now
- [ ] `components/TechBadge.tsx` — border-only, category colors (ecommerce=violet, martech=orange, infrastructure=sky, analytics=emerald)
- [ ] `App.tsx` — text-nav tabs (border-b active), thin stat row (no cards, no hero)
- [ ] Logs tab — monospace `[timestamp] [level] [event]`, level colors
- [ ] `npm run build` passes, fix TS errors
- [ ] Commit (note: repo is not currently a git repo — confirm with user)

## Review
(filled in after implementation)

---

# TechSignal — Worker test suite (Vitest)

## Plan
- [x] Read all units under test (parser, differ, kv-hash, ai-pitch, crawler)
- [x] Install vitest + @cloudflare/vitest-pool-workers
- [x] Runner: plain Vitest (node env) — all units use standard Web APIs; Workers pool brittle w/ placeholder binding ids
- [ ] Add SSRF guard to crawler (block private IPs + localhost, incl. redirect hops)
- [ ] src/__tests__/parser.test.ts
- [ ] src/__tests__/differ.test.ts
- [ ] src/__tests__/kv-hash.test.ts
- [ ] src/__tests__/ai-pitch.test.ts
- [ ] src/__tests__/crawler.test.ts
- [ ] package.json: add test / test:watch
- [ ] Run npm test, fix failures, report

## Review (test suite)
(filled in after run)
