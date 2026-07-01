/**
 * Feature flag helpers — read `NEXT_PUBLIC_FEATURE_*` env vars.
 *
 * Conventions:
 *   - Flag env var: `NEXT_PUBLIC_FEATURE_<NAME>=true|false`
 *   - Default: `false` (fail-closed — flags must be explicitly enabled)
 *   - Available on both server and client (the `NEXT_PUBLIC_` prefix).
 *
 * Story context: Sprint 6.1 INF-2 introduced this helper so A.5, B.1.3, and
 * B.3.1 can ship behind flags that default OFF in production. The locked
 * decision (Appendix A, Q3) keeps all three flags OFF in prod until CEO +
 * accountant + product-owner sign-off.
 *
 * @see docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md §INF-2
 */

import { useMemo } from 'react';

/**
 * Canonical list of feature flag names. Add new flags here so they're typed
 * everywhere they're read.
 */
export type FeatureFlag =
  | 'SHARED_MENU' // Story A.5 — shared sidebar config
  | 'SERVER_RBAC' // Story B.1.3 — server-side role enforcement for case status
  | 'PAYMENT_SOD' // Story B.3.1 — payment separation of duties
  | 'CLINICAL_CHECKLIST' // Story B.2.1 — UI: render 6 clinical items
  | 'CHECKLIST_GATE' // Story B.2.1 — server + UI: enforce allPassed on gated transitions
  | 'MINH_SCREEN' // Story B.4.1 — Replace h-screen with min-h-screen to fix iOS Safari URL-bar overlap
  | 'BILL_RECOMPUTE'; // Story PI-1 (Sprint 7.2) — Render the bill-recompute indicator chip next to "Tổng bill" on case detail

const ENV_PREFIX = 'NEXT_PUBLIC_FEATURE_';

function readEnv(name: string): string | undefined {
  // Access `process.env` defensively — server side has it always, client side
  // only has `NEXT_PUBLIC_*` baked in at build time. Both should be covered.
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[name];
}

/**
 * Check whether a feature flag is enabled.
 *
 * Server-side and client-side safe. Defaults to `false` when the env var is
 * missing or unparseable.
 */
export function isFlagEnabled(name: FeatureFlag): boolean {
  const raw = readEnv(`${ENV_PREFIX}${name}`);
  if (raw === undefined || raw === null || raw === '') return false;
  return String(raw).toLowerCase() === 'true';
}

/**
 * React hook that re-reads a feature flag on every render. The hook form is
 * safe to use in client components; on the server the value is stable for
 * the lifetime of the process (no re-render is needed).
 */
export function useFeatureFlag(name: FeatureFlag): boolean {
  return useMemo(() => isFlagEnabled(name), [name]);
}
