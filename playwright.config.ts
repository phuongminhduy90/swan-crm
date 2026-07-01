import { defineConfig, devices, type ViewportSize } from '@playwright/test';

/**
 * Playwright Visual Regression Configuration — Story C-3 (Sprint 6.4)
 *
 * This config drives a 5-route × 5-viewport visual snapshot matrix used as the
 * mobile baseline gate for the Swan CRM release pipeline.
 *
 * Scope (per SPRINT_6_4_EXECUTION_PLAN.md §2.5 / Appendix A.5):
 *   - 5 routes: /dashboard, /cases, /cases/[id], /customers/[id], /payments
 *   - 5 viewports: iPhone SE 360, iPhone 12 390, Pixel 7 412, iPad Mini 768, Desktop 1280
 *   - 25 baseline PNGs stored in docs/ux-redesign/visual-baselines/
 *
 * IMPORTANT:
 *   - Browser binaries (`npx playwright install chromium`) are NOT bundled here —
 *     first-time users must run that once before `npx playwright test`.
 *   - The target app must be reachable at `baseURL`. For local dev, run
 *     `npm run dev` in another terminal before invoking the harness.
 *   - In CI, the release-manager pipeline is expected to:
 *       1. start the dev server (`next dev -p 3000`)
 *       2. wait for /login or /dashboard to respond 200
 *       3. run this harness with `npx playwright test`
 *       4. fail the build on any snapshot diff > 0
 *
 * The harness is **idempotent**: first run captures baselines into
 * docs/ux-redesign/visual-baselines/, subsequent runs diff against those PNGs.
 * To intentionally refresh baselines after a UI redesign, run:
 *   `npx playwright test --update-snapshots`
 */

const VIEWPORT_MATRIX: Array<{
  name: string;
  viewport: ViewportSize;
  deviceScaleFactor: number;
  isMobile: boolean;
}> = [
  { name: 'iphone-se',        viewport: { width: 360, height: 667 }, deviceScaleFactor: 2, isMobile: true  },
  { name: 'iphone-12',        viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true  },
  { name: 'pixel-7',          viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true },
  { name: 'ipad-mini',        viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true },
  { name: 'desktop',          viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false },
];

/**
 * Seed entity IDs (deterministic across runs because mock-store is fixed).
 * Resolved from src/lib/mock/store.ts.
 * Update this list if seed data changes (notable ID drift = blocked baseline).
 */
const SEED_IDS = {
  case: 'case-001',
  customer: 'cus-001',
} as const;

export { VIEWPORT_MATRIX, SEED_IDS };

export default defineConfig({
  testDir: './tests',
  testMatch: /visual-regression\.spec\.ts/,

  // 5 routes × 5 viewports = 25 visual checks per run.
  // Each route is its own test file path, so the count is enforced by the
  // spec file (one `test()` per viewport inside a `describe()` per route).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // visual diffs must be reviewed, not auto-retried
  workers: 1, // serial — keeps baselines deterministic + reduces memory pressure

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Visual regression projects (one project per viewport so each snapshot
  // file is unambiguously keyed to its viewport in the report).
  projects: VIEWPORT_MATRIX.map((vp) => ({
    name: vp.name,
    use: {
      ...devices['Desktop Chrome'], // baseline browser engine for all
      viewport: vp.viewport,
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    },
  })),

  // No webServer block — operator is expected to start `npm run dev`
  // separately. This keeps the harness deterministic and avoids
  // Playwright re-spinning the dev server (which would defeat the
  // purpose of snapshot stability checks).
});