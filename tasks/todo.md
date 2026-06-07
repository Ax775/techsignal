# Stripe Checkout integration

## Backend
- [ ] Add Stripe env vars to src/types/env.ts (+ DASHBOARD_URL)
- [ ] src/lib/stripe.ts — Workers-compatible Stripe client factory
- [ ] CheckoutSchema in src/types/domain.ts
- [ ] src/routes/checkout.ts — POST /api/checkout (create session)
- [ ] src/routes/webhook.ts — POST /api/webhook (verify sig, unlock signal)
- [ ] Mount routers in src/index.ts; public-prefix bypass for checkout+webhook
- [ ] wrangler.toml — DASHBOARD_URL var + secret comments
- [ ] package.json — stripe ^14

## Frontend
- [ ] client.ts — createCheckoutSession()
- [ ] UnlockModal.tsx — replace mock unlock with Stripe redirect
- [ ] App.tsx — ?session_id= success toast + refresh

## Verify
- [ ] npm install stripe; tsc --noEmit clean (worker)
- [ ] dashboard tsc -b + build clean
- [ ] deploy worker + pages
- [ ] commit to origin/main
