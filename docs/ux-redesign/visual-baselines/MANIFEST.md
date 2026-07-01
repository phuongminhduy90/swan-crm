# Visual Regression Baseline Manifest — Story C-3 (Sprint 6.4)

> **Source of truth** for the 25 PNG files the release-manager gate expects to
> see in this directory after `npx playwright test` is run end-to-end.
>
> Any drift between this manifest and the actual files in the directory must
> be flagged to ui-designer + qa-architect. Drift = untracked baselines =
> blocked promotion.

---

## Matrix (5 routes × 5 viewports = 25 PNGs)

| # | Route | Path | Viewport | Filename |
|--:|:------|:-----|:---------|:---------|
|  1 | Dashboard       | `/dashboard`         | iPhone SE 360  | `dashboard-iphone-se.png` |
|  2 | Dashboard       | `/dashboard`         | iPhone 12 390  | `dashboard-iphone-12.png` |
|  3 | Dashboard       | `/dashboard`         | Pixel 7 412    | `dashboard-pixel-7.png` |
|  4 | Dashboard       | `/dashboard`         | iPad Mini 768  | `dashboard-ipad-mini.png` |
|  5 | Dashboard       | `/dashboard`         | Desktop 1280   | `dashboard-desktop.png` |
|  6 | Cases (list)    | `/cases`             | iPhone SE 360  | `cases-iphone-se.png` |
|  7 | Cases (list)    | `/cases`             | iPhone 12 390  | `cases-iphone-12.png` |
|  8 | Cases (list)    | `/cases`             | Pixel 7 412    | `cases-pixel-7.png` |
|  9 | Cases (list)    | `/cases`             | iPad Mini 768  | `cases-ipad-mini.png` |
| 10 | Cases (list)    | `/cases`             | Desktop 1280   | `cases-desktop.png` |
| 11 | Case detail     | `/cases/case-001`    | iPhone SE 360  | `cases-detail-iphone-se.png` |
| 12 | Case detail     | `/cases/case-001`    | iPhone 12 390  | `cases-detail-iphone-12.png` |
| 13 | Case detail     | `/cases/case-001`    | Pixel 7 412    | `cases-detail-pixel-7.png` |
| 14 | Case detail     | `/cases/case-001`    | iPad Mini 768  | `cases-detail-ipad-mini.png` |
| 15 | Case detail     | `/cases/case-001`    | Desktop 1280   | `cases-detail-desktop.png` |
| 16 | Customer detail | `/customers/cus-001` | iPhone SE 360  | `customers-detail-iphone-se.png` |
| 17 | Customer detail | `/customers/cus-001` | iPhone 12 390  | `customers-detail-iphone-12.png` |
| 18 | Customer detail | `/customers/cus-001` | Pixel 7 412    | `customers-detail-pixel-7.png` |
| 19 | Customer detail | `/customers/cus-001` | iPad Mini 768  | `customers-detail-ipad-mini.png` |
| 20 | Customer detail | `/customers/cus-001` | Desktop 1280   | `customers-detail-desktop.png` |
| 21 | Payments        | `/payments`          | iPhone SE 360  | `payments-iphone-se.png` |
| 22 | Payments        | `/payments`          | iPhone 12 390  | `payments-iphone-12.png` |
| 23 | Payments        | `/payments`          | Pixel 7 412    | `payments-pixel-7.png` |
| 24 | Payments        | `/payments`          | iPad Mini 768  | `payments-ipad-mini.png` |
| 25 | Payments        | `/payments`          | Desktop 1280   | `payments-desktop.png` |

**Total:** 25 files. The directory MUST contain exactly 25 PNGs after a clean baseline capture; anything less means a capture step failed silently.

---

## Why these specific entity IDs?

The dynamic routes use seed IDs from `src/lib/mock/store.ts`:

- **`/cases/case-001`** → case `SW-260620-001` (customer `cus-001`, Nguyễn Thị Bích Ngọc, 70M VND deposit). Chosen because it's the first case in the seed and has a wide mix of:
  - 1 service (Nâng ngực Ergo 2) → exercises the services tab
  - 1 payment (10M deposit, pending) → exercises the payments tab
  - status `draft` → exercises the status workflow tab
- **`/customers/cus-001`** → Nguyễn Thị Bích Ngọc. Chosen because she has:
  - Sensitive medical fields populated (privacy notes → exercises medical-note redacted rendering)
  - Full CCCD/address data → exercises sensitive-field rendering
  - VIP privacy level (`vip`) → exercises the gold privacy badge

If the seed changes (more meaningful case/customer in position #1), update `playwright.config.ts → SEED_IDS`. Do NOT edit individual baseline filenames.

---

## First-time capture (developer quickstart)

```bash
# 1. Install Playwright browser binaries (one-time, ~120 MB)
npx playwright install chromium

# 2. Start dev server in another terminal
npm run dev
# Server should be reachable at http://localhost:3000

# 3. Run the harness — first run captures baselines
npx playwright test

# 4. Verify the 25 PNGs landed here
ls docs/ux-redesign/visual-baselines/*.png | wc -l    # expect: 25

# 5. Commit the baselines
git add docs/ux-redesign/visual-baselines/*.png
git commit -m "chore(visual-baseline): capture v6.4 baseline (5 routes × 5 viewports)"
git tag -a visual-baseline-v6.4 -m "Story C-3 baseline capture"
```

## Re-running (idempotent diff)

```bash
# Re-run with the dev server still up
npx playwright test
# Exit 0 → no drift
# Exit 1 → at least one PNG differs from committed baseline; investigate
```

## Refreshing baselines after an intentional redesign

```bash
npx playwright test --update-snapshots
# Review the diff in your image viewer before committing
git add docs/ux-redesign/visual-baselines/*.png
git commit -m "chore(visual-baseline): refresh v6.4.x after <reason>"
git tag -af visual-baseline-v6.4 -m "Story C-3 baseline refresh"
```

---

## Storage budget

| Viewport | PNG size (est.) | Total (×5 routes) |
|:---------|----------------:|------------------:|
| iPhone SE 360  | ~80 KB  | ~400 KB |
| iPhone 12 390  | ~100 KB | ~500 KB |
| Pixel 7 412    | ~110 KB | ~550 KB |
| iPad Mini 768  | ~180 KB | ~900 KB |
| Desktop 1280   | ~250 KB | ~1.25 MB |
| **TOTAL**      |          | **~3.6 MB** |

Committed binary adds ~3.6 MB to the repo. Acceptable for a release gate that prevents regressions worth 10× that in QA time.

---

## Why these PNGs are NOT in git yet

The harness is wired and idempotent, but the **actual baseline PNGs require**:

1. Playwright browser binaries (`npx playwright install chromium`) — ~120 MB download
2. A running dev server (`npm run dev`) — must be reachable
3. ~30–60 s for the 25-snapshot matrix to complete

These are intentionally **operator-triggered** rather than committed-by-default, because:

- Adding 3.6 MB of binary to a single commit clutters the diff history
- CI should re-capture on tagged releases, not at every PR (avoids snapshot noise from unrelated changes)
- The harness + manifest are the auditable artifact; the PNGs are runtime evidence

The PNGs will be captured and tagged `visual-baseline-v6.4` as part of Sprint 6.4 Day 3 (per §5.2 of the execution plan), once the §13 anti-pattern gates + tsc/lint/build are green.

---

## See also

- [`STORY_C_3_VISUAL_BASELINE_REPORT.md`](../STORY_C_3_VISUAL_BASELINE_REPORT.md) — implementation rationale + anti-pattern gates
- [`STORY_C_3_MIGRATION_NOTES.md`](../STORY_C_3_MIGRATION_NOTES.md) — operator runbook + rollback
- [`../SPRINT_6_4_EXECUTION_PLAN.md` §2.5](../SPRINT_6_4_EXECUTION_PLAN.md) — story card + acceptance criteria
- [`../SPRINT_6_4_EXECUTION_PLAN.md` Appendix A.5](../SPRINT_6_4_EXECUTION_PLAN.md) — routing matrix