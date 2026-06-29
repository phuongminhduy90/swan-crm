/// <reference types="@testing-library/jest-dom" />

declare module 'jest-axe' {
  interface AxeViolation {
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{ html: string; target: string[] }>;
  }

  interface AxeResult {
    violations: AxeViolation[];
    incomplete?: unknown[];
    passes?: unknown[];
  }

  export const axe: (
    container: Element | string,
    options?: Record<string, unknown>,
  ) => Promise<AxeResult>;

  export const toHaveNoViolations: () => {
    pass: boolean;
    message: () => string;
  };
}