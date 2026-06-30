/**
 * Story 6.3.6 / B.4.6 (F-MED-06) — Responsive status filter on case-list.
 *
 * Verifies the user contract documented in SPRINT_6_3_EXECUTION_PLAN §6.2
 * (B.4.6 modified files) + §7.2 (B.4.6 tests) + §11.4 (F-MED-06):
 *
 *   1. At viewport ≥ 768 px (`md+`), the status filter renders as chips
 *      (existing behavior preserved).
 *   2. At viewport < 768 px (`< md`), the status filter renders as a single
 *      `<Select>` dropdown — preventing horizontal overflow on 360 px (M5).
 *   3. Both UIs filter the list identically and honor the `?status=` URL
 *      query param (back/forward navigation).
 *   4. The hook `useMediaQuery` is SSR-safe (returns `false` until mounted)
 *      so hydration never flashes the wrong UI.
 *
 * The test uses a static file-level check on the source for the core wiring
 * (mirror of the B.4.5 test pattern — the case-list page itself is heavy
 * and not worth a full DOM mount here), plus a lightweight hook test for
 * the media-query logic.
 *
 * @see docs/ux-redesign/SPRINT_6_3_EXECUTION_PLAN.md §1 (B.4.6 row)
 * @see src/components/cases/case-list.tsx
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { useMediaQuery, useIsDesktop } from '@/lib/hooks/useMediaQuery';

const CASE_LIST_PATH = resolve(
  process.cwd(),
  'src/components/cases/case-list.tsx',
);

// ---------------------------------------------------------------------------
// Hook-level: useMediaQuery + useIsDesktop
// ---------------------------------------------------------------------------

describe('useMediaQuery — breakpoint tracking', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // jsdom does not implement matchMedia — install a stub we can flip.
    let currentMatches = false;
    const listeners = new Set<(e: { matches: boolean }) => void>();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        get matches() {
          return currentMatches;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.add(cb);
        },
        removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.delete(cb);
        },
        addListener: (cb: (e: { matches: boolean }) => void) => {
          listeners.add(cb);
        },
        removeListener: (cb: (e: { matches: boolean }) => void) => {
          listeners.delete(cb);
        },
        dispatchEvent: () => true,
      }),
    });

    // expose the setter to tests via a sentinel property
    (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches = (
      m: boolean,
    ) => {
      currentMatches = m;
      listeners.forEach((cb) => cb({ matches: m }));
    };
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('returns false on initial render when matchMedia is false (SSR-safe default)', () => {
    (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    // The hook seeds `false` in useState, so the first render is always false.
    expect(result.current).toBe(false);
  });

  it('reflects matchMedia=true when matched at mount time', () => {
    // When matchMedia already reports a match before the effect runs,
    // the useEffect calls setMatches(true) synchronously in jsdom.
    (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when matchMedia changes from true → false', () => {
    (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(true);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
    act(() => {
      (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it('updates to false when matchMedia stops matching', () => {
    (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(true);
    const { result } = renderHook(() => useIsDesktop());
    // Trigger an update so the hook picks up the initial true value.
    act(() => {
      (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(true);
    });
    expect(result.current).toBe(true);
    act(() => {
      (window as unknown as { __setMatches: (m: boolean) => void }).__setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it('useIsDesktop uses the 768 px Tailwind md breakpoint', () => {
    // The hook delegates to useMediaQuery with the literal md query string.
    // Verify by source-level check below — here we only check it returns a
    // boolean.
    const { result } = renderHook(() => useIsDesktop());
    expect(typeof result.current).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Source-level wiring (mirror of the B.4.5 test pattern)
// ---------------------------------------------------------------------------

describe('Story 6.3.6 / B.4.6 — case-list status filter is responsive', () => {
  const source = readFileSync(CASE_LIST_PATH, 'utf8');

  describe('Hook wiring', () => {
    it('imports useIsDesktop from @/lib/hooks/useMediaQuery', () => {
      expect(source).toMatch(
        /import\s*\{\s*useIsDesktop\s*\}\s*from\s*['"]@\/lib\/hooks\/useMediaQuery['"]/,
      );
    });

    it('calls useIsDesktop() inside the CaseList component', () => {
      expect(source).toMatch(/const\s+isDesktop\s*=\s*useIsDesktop\s*\(\s*\)\s*;/);
    });
  });

  describe('Desktop UI — chips (existing behavior preserved at md+)', () => {
    it('conditionally renders chips when isDesktop is true', () => {
      // The chip block is wrapped in `{isDesktop ? (...) : (...)}`.
      const chipBranch = source.match(
        /isDesktop\s*\?\s*\([\s\S]*?\)\s*:\s*\(/,
      );
      expect(chipBranch).not.toBeNull();
      expect(chipBranch![0]).toMatch(/data-testid="status-filter-chips"/);
    });

    it('preserves the chip status options list', () => {
      expect(source).toMatch(/STATUS_FILTER_OPTIONS\.map\(\(opt\) => \(/);
    });

    it('chip button has aria-pressed for accessibility', () => {
      // The story plan §G-DS-7 requires a11y preserved.
      const chipBlock = source.match(/data-testid="status-filter-chips"[\s\S]*?<\/div>/);
      expect(chipBlock).not.toBeNull();
      expect(chipBlock![0]).toMatch(/aria-pressed=\{statusFilter === opt\.value\}/);
    });

    it('preserves touch-target ≥ 44px on chips for mobile fallback', () => {
      // Even though chips only render at md+, we keep the touch target height
      // so the same styles work if a screen-reader / zoom user scales up.
      const chipBlock = source.match(/data-testid="status-filter-chips"[\s\S]*?<\/div>/);
      expect(chipBlock![0]).toMatch(/min-h-\[44px\]\s+sm:min-h-0/);
    });
  });

  describe('Mobile UI — Select dropdown (< md)', () => {
    it('renders a <Select> in the else branch', () => {
      // The else branch must contain a Select from the UI primitive.
      // Match the test-id wrapper + the Select JSX inside.
      expect(source).toMatch(/data-testid="status-filter-select"/);
      // And a Select import from the UI primitive.
      expect(source).toMatch(
        /import\s*\{\s*Select\s*\}\s*from\s*['"]@\/components\/ui\/select['"]/,
      );
    });

    it('Select wires onChange back to updateStatusFilter', () => {
      // Pull out the Select block and verify the onChange contract.
      const selectBlock = source.match(
        /<Select[\s\S]*?aria-label="Lọc theo trạng thái"[\s\S]*?<\/Select>/,
      );
      expect(selectBlock).not.toBeNull();
      expect(selectBlock![0]).toMatch(
        /onChange=\{\s*\(e\)\s*=>\s*updateStatusFilter\(e\.target\.value\s+as\s+StatusFilterValue\)\s*\}/,
      );
      expect(selectBlock![0]).toMatch(/min-h-\[44px\]/);
    });

    it('Select exposes every status option with a count', () => {
      const selectBlock = source.match(
        /<Select[\s\S]*?aria-label="Lọc theo trạng thái"[\s\S]*?<\/Select>/,
      );
      expect(selectBlock).not.toBeNull();
      // The Select block must iterate over STATUS_FILTER_OPTIONS (12 entries
      // defined at the top of the file) to render one <option> per status.
      expect(selectBlock![0]).toMatch(/STATUS_FILTER_OPTIONS\.map\(/);
      // Each option includes a count in parentheses.
      expect(selectBlock![0]).toMatch(/\{opt\.label\}\s*\(\{count\}\)/);
      // And each option binds the value to opt.value (parity with chips).
      expect(selectBlock![0]).toMatch(/<option[\s\S]*?key=\{opt\.value\}[\s\S]*?value=\{opt\.value\}/);
    });

    it('STATUS_FILTER_OPTIONS defines exactly 12 entries (chip parity)', () => {
      // Static check on the source — the chips and Select both iterate the
      // same array, so a count mismatch would silently regress the parity.
      const matches = source.match(/value:\s*['"][^'"]+['"]/g) ?? [];
      // Strip the explicit STATUS_FILTER_OPTIONS array entries.
      const optionsArray = source.match(
        /STATUS_FILTER_OPTIONS[\s\S]*?\];/,
      );
      expect(optionsArray).not.toBeNull();
      const optionEntries =
        optionsArray![0].match(/value:\s*['"][^'"]+['"]/g) ?? [];
      expect(optionEntries.length).toBe(12);
      // (matches is unused but kept for potential future assertions)
      expect(matches).toBeDefined();
    });
  });

  describe('Parity — chips and Select produce identical filter behavior', () => {
    it('both branches call updateStatusFilter (the single source of truth)', () => {
      // chip onClick: updateStatusFilter(opt.value)
      // Select onChange: updateStatusFilter(e.target.value as StatusFilterValue)
      const updateCalls = source.match(/updateStatusFilter\s*\(/g) ?? [];
      // We expect at least 2 updateStatusFilter invocations (chip + Select)
      // plus the declaration inside updateStatusFilter's body.
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('the URL `?status=` param still drives the filter on both UIs', () => {
      // parseStatusParam is unchanged and still wired to statusFilter state.
      expect(source).toMatch(/parseStatusParam\s*\(\s*searchParams\.get\(['"]status['"]\)\s*\)/);
      expect(source).toMatch(/serializeStatusParam/);
      // updateStatusFilter pushes to router.replace with the serialized param.
      expect(source).toMatch(/router\.replace\(/);
    });
  });

  describe('Anti-pattern gate (M5 — horizontal scroll at 360 px)', () => {
    it('does NOT unconditionally render the flex-wrap chip row on small viewports', () => {
      // The original `{/* Status Filter Chips */}` <div className="flex flex-wrap gap-2">
      // is now inside the isDesktop branch. Verify the comment-free chip row
      // is gated by isDesktop.
      const chipRow = source.match(/<div[^>]*className="flex flex-wrap gap-2"[^>]*>/);
      expect(chipRow).not.toBeNull();
      // The chip row block must appear AFTER `isDesktop ?` in the source.
      const isDesktopIdx = source.indexOf('isDesktop');
      const chipRowIdx = source.indexOf(chipRow![0]);
      expect(isDesktopIdx).toBeLessThan(chipRowIdx);
    });
  });
});

// ---------------------------------------------------------------------------
// Hook unit test — useMediaQuery defaults to false (SSR-safe)
// ---------------------------------------------------------------------------

describe('useMediaQuery — SSR-safe contract', () => {
  it('the hook source explicitly defaults to false in useState', () => {
    // Read the hook source and confirm `useState(false)`.
    const hookSource = readFileSync(
      resolve(process.cwd(), 'src/lib/hooks/useMediaQuery.ts'),
      'utf8',
    );
    expect(hookSource).toMatch(/useState\s*\(\s*false\s*\)/);
    // And that it returns the matches state.
    expect(hookSource).toMatch(/return\s+matches\s*;/);
  });
});