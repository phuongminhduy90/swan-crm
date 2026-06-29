import '@testing-library/jest-dom/vitest';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'axe-core';

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