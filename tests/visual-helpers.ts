/**
 * Visual regression harness helpers — Story C-3 (Sprint 6.4)
 *
 * Pure helpers (no Playwright API) used by `tests/visual-regression.spec.ts`
 * to keep the spec file readable and the matrix constants in one place.
 *
 * The matrix here is the single source of truth for what 25 PNGs the
 * release-manager gate expects to see in docs/ux-redesign/visual-baselines/.
 * Any change here MUST be reflected in:
 *   - docs/ux-redesign/visual-baselines/MANIFEST.md
 *   - docs/ux-redesign/STORY_C_3_VISUAL_BASELINE_REPORT.md
 *   - SPRINT_6_4_EXECUTION_PLAN.md §2.5 / Appendix A.5
 */

import { VIEWPORT_MATRIX, SEED_IDS } from '../playwright.config';

/** Route slugs (filename-safe). */
export const ROUTES = [
  'dashboard',
  'cases',
  'cases-detail',
  'customers-detail',
  'payments',
] as const;

export type RouteSlug = (typeof ROUTES)[number];

/** Map route slug → concrete path on the dev server. */
export const ROUTE_PATHS: Record<RouteSlug, string> = {
  dashboard:         '/dashboard',
  cases:             '/cases',
  'cases-detail':    `/cases/${SEED_IDS.case}`,
  'customers-detail': `/customers/${SEED_IDS.customer}`,
  payments:          '/payments',
};

/** Human-friendly label per route (Vietnamese). */
export const ROUTE_LABELS: Record<RouteSlug, string> = {
  'dashboard':          'Dashboard',
  'cases':              'Hồ sơ CASE (list)',
  'cases-detail':       'Chi tiết CASE',
  'customers-detail':   'Chi tiết khách hàng',
  'payments':           'Quản lý thanh toán',
};

/** Filename convention: <route>-<viewport>.png (kebab-case, lowercase). */
export function baselineFilename(
  route: RouteSlug,
  viewportName: string,
): string {
  return `${route}-${viewportName}.png`;
}

/** Absolute filesystem path to the baseline PNG for a given route + viewport. */
export function baselinePath(
  route: RouteSlug,
  viewportName: string,
): string {
  return `docs/ux-redesign/visual-baselines/${baselineFilename(route, viewportName)}`;
}

/**
 * Expand the (routes × viewports) matrix into a flat list of test cases.
 * Each entry is what a single `test()` body uses to know what to render
 * and what to assert against.
 */
export interface VisualCase {
  route: RouteSlug;
  routePath: string;
  routeLabel: string;
  viewportName: string;
  viewportWidth: number;
  viewportHeight: number;
  isMobile: boolean;
}

export function expandMatrix(): VisualCase[] {
  const out: VisualCase[] = [];
  for (const route of ROUTES) {
    for (const vp of VIEWPORT_MATRIX) {
      out.push({
        route,
        routePath: ROUTE_PATHS[route],
        routeLabel: ROUTE_LABELS[route],
        viewportName: vp.name,
        viewportWidth: vp.viewport.width,
        viewportHeight: vp.viewport.height,
        isMobile: vp.isMobile,
      });
    }
  }
  return out;
}

/** Number of expected baseline PNGs (5 routes × 5 viewports). */
export const EXPECTED_BASELINE_COUNT = ROUTES.length * VIEWPORT_MATRIX.length;

/** Viewport human labels (used in failure messages). */
export const VIEWPORT_LABELS: Record<string, string> = {
  'iphone-se':  'iPhone SE 360×667',
  'iphone-12':  'iPhone 12 390×844',
  'pixel-7':    'Pixel 7 412×915',
  'ipad-mini':  'iPad Mini 768×1024',
  'desktop':    'Desktop Chrome 1280×800',
};

/** Standard timeout for "wait for app shell to render" before snapshot. */
export const RENDER_SETTLE_MS = 1500;

/**
 * Selector for the main app shell — used to wait for hydration to settle
 * before taking a snapshot. The CRM shell renders a `<main>` inside the
 * protected layout; if that's not visible, the page hasn't finished
 * loading and a baseline captured now would be all-blank.
 */
export const APP_SHELL_READY_SELECTOR = 'main';

/**
 * Dev-mode login note: the harness assumes the operator is running with
 * NEXT_PUBLIC_DEV_MODE=true, which auto-bypasses auth on protected routes.
 * For a production-staging snapshot, see the auth-flow note in the
 * implementation report.
 */
export const DEV_MODE_LOGIN_NOTE =
  'Dev mode bypass is enabled (NEXT_PUBLIC_DEV_MODE=true); ' +
  'protected routes render without auth form. ' +
  'For staging snapshots, see STORY_C_3_VISUAL_BASELINE_REPORT.md §Auth.';