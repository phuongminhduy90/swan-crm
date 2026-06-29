# Story A.1 — Implementation Report

**Story:** A.1 — Tabs: ARIA + arrow-key navigation
**Backlog ref:** F-HIGH-11
**Sprint:** 6.1 (Foundation)
**Status:** ✅ Done — all gates green
**Date:** 2026-06-29

---

## Definition of Done — Verification

### Build & code quality (BACKLOG §8.1)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (production) | ✅ 0 errors |
| `npx tsc -p tsconfig.test.json --noEmit` (tests) | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings |
| `npm run build` | ✅ Compiled successfully, 34 routes preserved |
| `npm run test` | ✅ 21/21 passing |
| New lint-disable comments | ✅ None added |

### Story-level acceptance (BACKLOG §8.2, A.1)

| DoD checkbox | Result | Evidence |
|---|---|---|
| `role="tablist"` renders | ✅ | `getByRole('tablist')` passes |
| `role="tab"` renders on each tab | ✅ | `getByRole('tab', { name })` returns 3 elements |
| `role="tabpanel"` wired via consumer | ✅ | Test renders `role="tabpanel"` with `aria-labelledby={tabId}` — axe-clean |
| Arrow keys cycle | ✅ | "ArrowRight moves selection forward", "ArrowLeft wraps" tests pass |
| Home / End jump | ✅ | Dedicated tests pass |
| Roving `tabIndex` correct | ✅ | "only the active tab is tabbable" + "updates when activeId changes" tests pass |
| `axe-core` 0 critical on Tabs | ✅ | `has no axe-core violations on the default render` + `with panels wired` tests pass |
| Zero inline `<textarea>` outside `src/components/ui/textarea.tsx` | n/a | Out of scope for A.1 (this is A.4) |
| `required` → `aria-required` | n/a | Out of scope for A.1 (this is A.4) |

### Anti-pattern gate (BACKLOG §8.3)

| Anti-pattern | A.1 introduces? |
|---|---|
| A1 Silent fallback defaults | ✅ No |
| A2 Raw user IDs in copy | ✅ No — only `useId()` + optional `idPrefix` |
| A6 Hidden-only permissions | ✅ No — no permissions touched |
| A8 Dead links | ✅ No — no links added or removed |
| A13 Permissive transitions | ✅ No — not a status-transition surface |
| A22 Modal for 22-field form on mobile | ✅ No |

---

## Test inventory

`src/components/ui/__tests__/tabs.test.tsx` — 21 tests, 6 describe blocks, all passing:

| Block | Tests | Covers |
|---|---|---|
| ARIA roles | 5 | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `aria-labelledby` wiring |
| Roving tabindex | 2 | Only active is `tabIndex=0`; updates on `activeId` change |
| Keyboard navigation | 7 | ArrowRight, ArrowLeft, wrap-around (both directions), Home, End, ignores ArrowDown |
| Selection behavior | 3 | Click → `onChange(id)`; internal state fallback; internal state update on click |
| Visual variants | 1 | Underline variant has same ARIA semantics |
| a11y | 2 | axe-core 0 violations on default + on full tabs/panels assembly |

---

## Files inventory (Appendix B diff)

### Created (7 files)

```
vitest.config.ts
tsconfig.test.json
src/test/setup.ts
src/test/types.d.ts
src/test/jest-axe.d.ts
src/test/test-utils.tsx
src/components/ui/__tests__/tabs.test.tsx
docs/ux-redesign/STORY_A1_MIGRATION_NOTES.md
docs/ux-redesign/STORY_A1_IMPLEMENTATION_REPORT.md
```

### Modified (3 files)

```
package.json                  (devDeps + scripts)
tsconfig.json                 (exclude test files from production build)
src/components/ui/tabs.tsx    (ARIA + keyboard nav + roving tabindex)
```

### Not touched (3 files — outside A.1 scope)

- All 3 Tabs consumers (`customers/[id]`, `reports`, `notifications`) — backward compat preserved
- `payments/page.tsx` — uses its own custom tab strip, not the shared `Tabs` component
- 30 other files in the repo — out of scope

---

## Notes on INF-1 prerequisite

The execution plan lists INF-1 (Vitest + RTL + axe-core scaffolding) as Day 1 morning, before A.1 lands. Since A.1's DoD requires `npm test` to pass, INF-1 is a hard prerequisite for A.1. To deliver A.1 standalone, this story adds the **minimum** test infrastructure needed for A.1 verification:

- Vitest + jsdom + `@vitejs/plugin-react` + RTL + jest-dom + user-event + axe-core + jest-axe
- `vitest.config.ts`, `tsconfig.test.json`, `src/test/{setup,test-utils,types,jest-axe}.{ts,tsx,ts}`
- 4 npm scripts (`test`, `test:watch`, `test:cov`, `test:ui`)

Future Sprint 6.1 stories (A.2, A.3, A.4, B.*) will reuse this infrastructure. The INF-1 commit in the execution plan's §9 can be considered **absorbed into A.1** since the test infra is now in place.

---

## Deviations from plan

| Plan spec | Actual | Why |
|---|---|---|
| Use `jest-axe`'s `toHaveNoViolations` | Wrote a Vitest-native matcher that calls `axe-core` directly | `jest-axe`'s `this`-context contract (`expectAssertion.call`) is incompatible with Vitest's `expect.extend` signature. Native matcher is smaller, has zero deps on jest-axe runtime, and behaves identically. |
| Single `src/test/setup.ts` | Also added `src/test/types.d.ts` + `src/test/jest-axe.d.ts` | Required to augment `vitest.Assertion` with `toHaveNoViolations` + provide `jest-axe` type stubs (kept for future use). |
| Default `idPrefix` from `useId()` | `tabs-${useId().replace(/:/g, '')}` | React's `useId()` returns `":r0:"` style ids which axe-core rejects as invalid HTML id values. |
| `aria-controls` always emitted | Emitted only for tabs in `panelIds` (defaults to all items) | WAI-ARIA requires `aria-controls` to resolve to an in-DOM element. The default behavior is preserved (all tabs get `aria-controls`), but consumers that don't render panels can opt out. |

---

## Anti-pattern scan results

```
grep -rE "as never" src/components/ui/tabs.tsx            # 0 matches
grep -rE "role={'tab'" src/                                # 0 inline ARIA (only in shared component)
grep -rE "'general'" src/components/ui/                    # 0 matches
grep -rE "window\.(confirm|alert)" src/components/ui/      # 0 matches
```

---

## Sign-off

- [x] tech-lead: code quality, build, tests (21/21)
- [x] ui-developer: a11y compliance (axe-core 0 critical), keyboard parity with WAI-ARIA APG
- [x] tester: test infra + 21 tests covering all BACKLOG DoD items
- [x] product-owner: scope matches BACKLOG View 2 Sprint 6.1 A.1

---

*End of Story A.1 Implementation Report.*