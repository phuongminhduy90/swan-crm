import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'axe-core';

// ---------------------------------------------------------------------------
// jsdom does not implement `window.matchMedia` natively — but a growing
// number of components in this app rely on `useMediaQuery` (Sprint 6.3 +
// Sprint 7.1). Install a minimal stub that defaults to `matches: false`
// (mobile) and lets individual suites override the return value via the
// `__setMatches` hook on `window`. The active-tab tests and a11y tests work
// without any per-suite override because they don't care about viewport.
// ---------------------------------------------------------------------------
const matchMediaListeners = new Set<(e: { matches: boolean }) => void>();
const matchMediaStub = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: (cb: (e: { matches: boolean }) => void) => matchMediaListeners.add(cb),
  removeListener: (cb: (e: { matches: boolean }) => void) => matchMediaListeners.delete(cb),
  addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => matchMediaListeners.add(cb),
  removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => matchMediaListeners.delete(cb),
  dispatchEvent: () => true,
});

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: matchMediaStub,
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __setMatchMedia: (matches: boolean) => void;
}

beforeEach(() => {
  matchMediaListeners.clear();
  globalThis.__setMatchMedia = (matches: boolean) => {
    matchMediaListeners.forEach((cb) => cb({ matches }));
  };
});

afterEach(() => {
  cleanup();
});

interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{ html: string; target: string[] }>;
}

interface AxeResults {
  violations: AxeViolation[];
  incomplete?: unknown[];
  passes?: unknown[];
}

declare global {
  // eslint-disable-next-line no-var
  var axe: {
    run: (context: Element | string, options?: Record<string, unknown>) => Promise<AxeResults>;
  };
}

/**
 * Minimal axe-core matcher for Vitest. Uses the global `axe` registered by
 * the `axe-core` IIFE on `window` (available in jsdom).
 */
expect.extend({
  async toHaveNoViolations(actual: Element) {
    const results = await globalThis.axe.run(actual as unknown as Element);
    const violations = results.violations ?? [];
    if (violations.length === 0) {
      return {
        pass: true,
        message: () => 'Expected no axe violations but found none',
      };
    }
    const formatted = violations
      .map(
        (v) =>
          `[${v.id}] ${v.impact} — ${v.description}\n` +
          v.nodes.map((n) => `  ${n.html}`).join('\n'),
      )
      .join('\n\n');
    return {
      pass: false,
      message: () =>
        `Expected no axe violations but found ${violations.length}:\n\n${formatted}`,
    };
  },
});