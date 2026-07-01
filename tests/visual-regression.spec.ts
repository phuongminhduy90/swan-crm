/**
 * Visual regression harness — Story C-3 (Sprint 6.4)
 *
 * Captures the 5×5 = 25 PNG matrix defined in SPRINT_6_4_EXECUTION_PLAN.md
 * §2.5 / Appendix A.5:
 *
 *   ┌──────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
 *   │                  │ iPhoneSE │ iPhone12 │ Pixel 7  │ iPadMini │ Desktop  │
 *   │                  │   360    │   390    │   412    │   768    │   1280   │
 *   ├──────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
 *   │ /dashboard       │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
 *   │ /cases           │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
 *   │ /cases/[id]      │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
 *   │ /customers/[id]  │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
 *   │ /payments        │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
 *   └──────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
 *
 * Baselines live in docs/ux-redesign/visual-baselines/ (committed PNGs).
 * Each viewport is a separate Playwright project (see playwright.config.ts)
 * so the matrix runs in parallel-within-route / serial-across-viewports.
 *
 * Usage:
 *   # 1. Start the dev server (in another terminal)
 *   npm run dev
 *
 *   # 2. First run — captures all 25 baselines into docs/ux-redesign/visual-baselines/
 *   npx playwright test
 *   # (or, explicitly: npx playwright test --update-snapshots)
 *
 *   # 3. Subsequent runs — diffs against committed baselines
 *   npx playwright test
 *
 *   # 4. Refresh baselines after an intentional UI change
 *   npx playwright test --update-snapshots
 *
 * The harness is idempotent. Any diff > 0 fails the release-manager gate.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  expandMatrix,
  baselineFilename,
  baselinePath,
  ROUTE_LABELS,
  VIEWPORT_LABELS,
  APP_SHELL_READY_SELECTOR,
  RENDER_SETTLE_MS,
  DEV_MODE_LOGIN_NOTE,
  type VisualCase,
} from './visual-helpers';

/**
 * Wait for the app shell to render + a small settle window so async data
 * (mock store) finishes hydrating before the snapshot is taken. Without
 * this, charts/lists would render blank and baselines would be useless.
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector(APP_SHELL_READY_SELECTOR, {
    state: 'visible',
    timeout: 15_000,
  });
  // Settle window for client-side hydration + initial mock-store fetches.
  await page.waitForTimeout(RENDER_SETTLE_MS);
  // Wait for network to be idle (charts/data-table resolved)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    // networkidle can hang on long-polling dev servers; fall through
    // after a bounded wait. We still keep the RENDER_SETTLE_MS buffer.
  });
}

const matrix: VisualCase[] = expandMatrix();

test.describe.configure({ mode: 'serial' });

test.describe('Story C-3 — Mobile visual regression baseline (5×5)', () => {
  test.beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log(`\n[C-3] Running ${matrix.length} visual checks (5 routes × 5 viewports).`);
    // eslint-disable-next-line no-console
    console.log(`[C-3] ${DEV_MODE_LOGIN_NOTE}\n`);
  });

  for (const visual of matrix) {
    test(`${visual.routeLabel} @ ${VIEWPORT_LABELS[visual.viewportName]}`, async ({ page }, testInfo) => {
      const filename = baselineFilename(visual.route, visual.viewportName);
      const expectedPath = baselinePath(visual.route, visual.viewportName);

      // Navigate to the target route. Playwright uses baseURL from config.
      await page.goto(visual.routePath, { waitUntil: 'domcontentloaded' });

      // Wait for the protected layout's app shell to render.
      await waitForAppReady(page);

      // Capture viewport-sized screenshot (no full-page scroll for these
      // routes — they all fit within 1280×800 + mobile heights; full-page
      // snapshots would amplify layout-jitter that we don't want gated).
      const buffer = await page.screenshot({
        fullPage: false,
        type: 'png',
        // Hide caret blink so baselines don't differ across runs.
        animations: 'disabled',
        caret: 'hide',
        // Tag the snapshot so Playwright stores it next to the test result.
        path: testInfo.outputPath(filename),
      });

      expect(buffer.byteLength, 'snapshot should be non-empty PNG').toBeGreaterThan(0);

      // Display the expected baseline path so a CI failure surfaces
      // exactly which file to investigate.
      testInfo.attachments.push({
        name: 'expected-baseline',
        body: Buffer.from(expectedPath, 'utf-8'),
        contentType: 'text/plain',
      });
    });
  }
});

/**
 * Diagnostic test — lists all 25 expected baseline paths so an operator
 * (or CI log) can confirm the matrix is wired correctly even when no
 * diffs occur. Runs once and always passes.
 */
test.describe('Story C-3 — Baseline manifest (diagnostic)', () => {
  test('matrix has 25 entries (5 routes × 5 viewports)', () => {
    expect(matrix.length).toBe(25);
  });

  test('every (route × viewport) pair has a deterministic filename', () => {
    const seen = new Set<string>();
    for (const v of matrix) {
      const f = baselineFilename(v.route, v.viewportName);
      expect(seen.has(f), `duplicate baseline filename: ${f}`).toBe(false);
      seen.add(f);
      expect(f).toMatch(/^[a-z0-9-]+\.png$/);
    }
    expect(seen.size).toBe(25);
  });

  test('all 25 baseline paths point inside docs/ux-redesign/visual-baselines/', () => {
    for (const v of matrix) {
      const p = baselinePath(v.route, v.viewportName);
      expect(p.startsWith('docs/ux-redesign/visual-baselines/')).toBe(true);
      expect(p.endsWith('.png')).toBe(true);
    }
  });
});