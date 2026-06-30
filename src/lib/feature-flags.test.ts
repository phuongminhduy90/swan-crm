import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isFlagEnabled } from '@/lib/feature-flags';

/**
 * Story INF-2 — `isFlagEnabled()` reads `NEXT_PUBLIC_FEATURE_*` env vars.
 * ID: INF-2 | Sprint: 6.1 | Owner: FE-1
 *
 * @see docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md §2.2, §INF-2
 */
describe('feature-flags — isFlagEnabled()', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Each test starts with a fresh copy so we can mutate freely.
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns false when the env var is missing (default = OFF)', () => {
    delete process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC;
    expect(isFlagEnabled('SERVER_RBAC')).toBe(false);
  });

  it('returns false when the env var is an empty string', () => {
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = '';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(false);
  });

  it('returns true when the env var is "true" (lowercase)', () => {
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'true';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(true);
  });

  it('returns true when the env var is "TRUE" (case-insensitive)', () => {
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'TRUE';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(true);
  });

  it('returns true when the env var is "True" (mixed case)', () => {
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'True';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(true);
  });

  it('returns false for any value other than "true" (fail-closed)', () => {
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = '1';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'yes';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_SERVER_RBAC = 'false';
    expect(isFlagEnabled('SERVER_RBAC')).toBe(false);
  });

  it('isolates flags by name (one flag does not leak into another)', () => {
    process.env.NEXT_PUBLIC_FEATURE_SHARED_MENU = 'true';
    expect(isFlagEnabled('SHARED_MENU')).toBe(true);
    expect(isFlagEnabled('SERVER_RBAC')).toBe(false);
    expect(isFlagEnabled('PAYMENT_SOD')).toBe(false);
  });

  it('returns false for the MINH_SCREEN flag when env is missing (Story B.4.1)', () => {
    delete process.env.NEXT_PUBLIC_FEATURE_MINH_SCREEN;
    expect(isFlagEnabled('MINH_SCREEN')).toBe(false);
  });

  it('returns true for the MINH_SCREEN flag when env is "true" (Story B.4.1)', () => {
    process.env.NEXT_PUBLIC_FEATURE_MINH_SCREEN = 'true';
    expect(isFlagEnabled('MINH_SCREEN')).toBe(true);
  });
});
