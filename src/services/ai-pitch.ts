import type { ChangeType } from '../types/domain';

export interface PitchRequest {
  domain: string;
  companyName: string | null;
  changeType: ChangeType;
  techInvolved: string;
  description: string;
}

function displayName(req: PitchRequest): string {
  return req.companyName?.trim() || req.domain;
}

function churnTemplate(req: PitchRequest): string {
  const name = displayName(req);
  return `Subject: ${req.domain} just dropped ${req.techInvolved} — let's talk timing

Hi there,

I noticed ${name} recently moved off ${req.techInvolved}. In our experience, the weeks right after a stack change like this are when teams feel the gaps most — broken workflows, data that no longer syncs, and reporting that suddenly needs rebuilding.

We help companies in exactly this window get back to full speed faster, without the usual 3-month re-implementation slog. A few of our customers made the same switch and were live again in under two weeks.

Would a 15-minute call this week make sense to compare notes on how others handled the transition? Happy to share a short teardown of what typically breaks first and how to get ahead of it.

Best,
[Your name]

P.S. No pitch deck — just a practical checklist for the first 30 days after dropping ${req.techInvolved}.`;
}

function adoptionTemplate(req: PitchRequest): string {
  const name = displayName(req);
  return `Subject: Saw ${name} just rolled out ${req.techInvolved} — quick idea

Hi there,

Congrats on bringing ${req.techInvolved} into the stack at ${req.domain}. New tooling is exciting, but the first 60 days are usually where teams either compound the value or quietly under-use it.

We plug into ${req.techInvolved} to help teams skip the slow ramp — getting clean data flowing, dashboards that the whole team actually trusts, and the integrations that make it stick. Most teams see the difference within the first sprint.

Worth a 15-minute call to share what high-performing ${req.techInvolved} teams do differently in month one? I can send a short adoption playbook ahead of time so the call is useful either way.

Best,
[Your name]

P.S. The playbook covers the three integrations teams almost always wire up too late.`;
}

function vulnerabilityTemplate(req: PitchRequest): string {
  const name = displayName(req);
  return `Subject: A heads-up on ${req.domain}'s ${req.techInvolved} setup

Hi there,

While researching ${name}, I noticed your ${req.techInvolved} configuration sits in a pattern we see exploited more often than most teams expect — the kind of exposure that's invisible day-to-day until it isn't.

I'm not writing to alarm you; this is genuinely common and very fixable. We help teams close exactly this gap quickly, usually without touching the rest of the stack or slowing the store down.

Would it be useful to walk you through what we'd check first? I can do a 15-minute, no-obligation review of the specific surface area and hand you a short remediation checklist either way.

Best,
[Your name]

P.S. Happy to share an anonymized example of how a similar ${req.techInvolved} setup was hardened in an afternoon.`;
}

/**
 * Generate a cold-outreach pitch for an intent signal.
 *
 * Currently deterministic/mocked so the platform works end-to-end with zero
 * external dependencies. To switch to a live LLM, replace the body of the
 * `if (apiKey)` branch below with a real call, e.g.:
 *
 *   const res = await fetch('https://api.openai.com/v1/chat/completions', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       Authorization: `Bearer ${apiKey}`,
 *     },
 *     body: JSON.stringify({
 *       model: 'gpt-4o-mini',
 *       messages: [
 *         { role: 'system', content: 'You write concise B2B cold emails.' },
 *         { role: 'user', content: buildPrompt(req) },
 *       ],
 *     }),
 *   });
 *   const json = await res.json();
 *   return json.choices[0].message.content;
 *
 * The mock and the live path share the same PitchRequest contract, so swapping
 * is a one-function change.
 */
export async function generatePitch(
  req: PitchRequest,
  apiKey?: string,
): Promise<string> {
  // Placeholder for the live LLM path. When an API key is present a real
  // implementation would call out here; for now we always fall through to the
  // high-quality deterministic templates so behaviour is identical offline.
  if (apiKey) {
    // INJECT LIVE LLM CALL HERE (see doc comment above). Falls through to the
    // template path until implemented so generation never fails.
  }

  switch (req.changeType) {
    case 'churn':
      return churnTemplate(req);
    case 'adoption':
      return adoptionTemplate(req);
    case 'vulnerability':
      return vulnerabilityTemplate(req);
    default: {
      // Exhaustiveness guard — unreachable given the ChangeType union.
      const _never: never = req.changeType;
      return _never;
    }
  }
}
