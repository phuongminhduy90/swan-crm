# Story PI-5 — Anti-pattern Catalog Extension + TD-7 Cleanup — Migration Notes

> **Story:** PI-5 (Sprint 7.2)
> **Audience:** Engineers who interact with the anti-pattern pre-commit gate, the Topbar, or the shared menu config.
> **Breaking change scope:** None. PI-5 is additive + a single literal substitution.

---

## TL;DR

Two independent changes shipped in one story:

1. **`topbar.tsx:71` fallback literal changed from `'user-001'` to `'placeholder'`** (TD-7).
   - No behavior change for the no-auth path (still fetches `/api/notifications`, gets an empty result).
   - The A2 anti-pattern gate (`scripts/check-anti-patterns.sh --all`) no longer reports a match in `topbar.tsx`.
   - Any other code that hard-coded the `'user-001'` fallback string will NOT find it; use the new `FALLBACK_USER_ID` constant if you import it from `topbar.tsx` (currently NOT exported — see §3 below).

2. **`scripts/check-anti-patterns.sh` catalog grew from 4 to 5 rows** (A10 added).
   - The new row catches raw `<input type="number">` patterns used for currency context.
   - Recovery primitive: `<CurrencyInput>` from `@/components/ui/currency-input` (ships in Sprint 7.2 C.2.1).
   - The regex is single-line only (POSIX ERE `[^>]*` does not span newlines), so multi-line raw inputs in current code (case-form, payment-form, service-form) are NOT blocked yet — they will be replaced by `<CurrencyInput>` in C.2.1.

PI-5 also confirms C.2.4 (shared menu config): the architecture is already a single source (`src/config/sidebar-menu.ts`), consumed by both `Sidebar` and `MobileNav` via `useVisibleMenu`. No code changes.

---

## Migration map for each consumer

### 1. Anti-pattern gate consumers (CI / pre-commit)

**Before PI-5:** `bash scripts/check-anti-patterns.sh --all` would return exit 1 with 1 A2 match in `src/components/layout/topbar.tsx:71`.

**After PI-5:** `--all` returns exit 0 against the same tree.

| Caller | Before | After |
|:-------|:-------|:------|
| `git config core.hooksPath .githooks` (pre-commit) | unaffected (only scans staged files) | unaffected |
| CI `bash scripts/check-anti-patterns.sh --all` | exit 1 (false positive on `topbar.tsx:71`) | exit 0 (clean) |
| Manual audit `bash scripts/check-anti-patterns.sh --all` | reports 1 false positive | reports 0 matches |

### 2. New A10 rule in the catalog

A10 is the first catalog row that requires an *external* recovery primitive (`<CurrencyInput>`) that doesn't exist yet. The plan is:

1. **Sprint 7.2 PI-5 (this PR)** — Add A10 to the catalog. No violations in current code (multi-line inputs are not matched). Clean gate.
2. **Sprint 7.2 C.2.1** — Ship `<CurrencyInput>` primitive. Migrate the 3 call sites (`payment-form.tsx`, `case-form.tsx`, `service-form.tsx`) to use it. A10 stays clean.
3. **Future PRs** — Any new single-line `<input type="number" name="amount" />` style input will be caught by `--staged` mode and blocked at commit time. Recovery: use `<CurrencyInput>`.

If a future PR introduces a single-line raw numeric currency input BEFORE `<CurrencyInput>` lands, the developer can:
- Use `<Input type="number">` (the project wrapper, NOT the raw HTML element) — this also matches A10 if written as `<Input type="number" name="amount" />` (capital `<Input>` is matched because the regex is `<[iI]nput`).
- Bypass: `git commit --no-verify` (P0/P1 hotfixes only; subject still must follow Conventional Commits per Sprint 7.1 §1).

### 3. Topbar `'user-001'` fallback

The fallback string is consumed by:

| Site | Behavior |
|:-----|:---------|
| `fetchNotifications` (line 76) | `fetch(\`/api/notifications?userId=${currentUserId}\`)` — empty list returned for unknown ID |
| `handleNotificationClick` (line 138) | marks the notification as read for the fallback ID — no-op for unknown ID |
| `handleMarkAllRead` (line 161) | marks all as read for the fallback ID — no-op for unknown ID |

**Before PI-5:** Fallback was `'user-001'`. The `/api/notifications` endpoint would return the actual admin's notifications (cosmetic leak in dev mode).

**After PI-5:** Fallback is `'placeholder'`. Unknown user ID returns empty.

If your code imports the fallback constant:

```ts
// BAD — undefined after PI-5
import { FALLBACK_USER_ID } from '@/components/layout/topbar';  // not exported

// GOOD — read the constant by name
const currentUserId = userProfile?.id ?? 'placeholder';
// or
import { TOPBAR_FALLBACK_USER_ID } from '@/components/layout/topbar';
// (only if you make it exported — see PR suggestion below)
```

**Recommendation:** Make `FALLBACK_USER_ID` exported from `topbar.tsx` if future callers need it. PI-5 deliberately keeps it module-local because the only legitimate caller is `topbar.tsx` itself; cross-module imports would suggest a coupling smell (use a proper `useCurrentUser()` hook instead).

### 4. Shared menu config (C.2.4)

**No migration needed.** The shared menu architecture is already in place from Sprint 6.1 (A.5) and Sprint 7.1 (UI refactor). PI-5 only verified the configuration:

- `src/config/sidebar-menu.ts` is the single source of truth.
- `src/lib/hooks/useVisibleMenu.ts` consumes it and applies role-based filtering (under `FEATURE_SHARED_MENU` flag).
- `src/components/layout/sidebar.tsx` and `src/components/layout/mobile-nav.tsx` both consume `useVisibleMenu()`.

**Audit grep for shared menu consumers:**

```bash
# All consumers of MENU_ITEMS:
grep -rE "MENU_ITEMS|SETTINGS_SUB_ITEMS|BOTTOM_ITEMS" src/
# Expected output:
#   src/config/sidebar-menu.ts:1    (declaration)
#   src/lib/hooks/useVisibleMenu.ts:2  (import + return)
#   src/lib/hooks/useVisibleMenu.ts:1  (return)
# = 4 hits total. NO inline arrays in Sidebar or MobileNav.
```

If a future PR adds an inline `MENU_ITEMS = [...]` array in another component, that's a regression — flag it in code review.

---

## Action items for downstream stories

### Sprint 7.2 C.2.1 (`<CurrencyInput>` primitive)

When shipping C.2.1, the A10 gate will need a complementary action:

1. The new `<CurrencyInput>` component must live at `src/components/ui/currency-input.tsx`.
2. The component must NOT use raw `<input type="number">` internally — it should use a controlled `<input type="text">` with `inputMode="numeric"` and custom thousand-separator logic (so it doesn't match A10 itself).
3. After C.2.1, the 3 multi-line raw inputs in `case-form.tsx`, `payment-form.tsx`, `service-form.tsx` should be replaced with `<CurrencyInput>` (also outside A10's current single-line scope — the gate would have allowed them, but the convention is to use `<CurrencyInput>` for all currency inputs regardless).
4. Consider extending A10 to catch multi-line inputs in a follow-up TD after C.2.1 lands — the regex could use the `rg -U` (multiline) flag or a PCRE-style `(?s)` modifier. PI-5 keeps it single-line so the current tree stays clean during the C.2.1 transition window.

### Sprint 7.4 (anti-pattern catalog extensions)

The TD-6 backlog (`STORY_TD_6_IMPLEMENTATION_REPORT.md` §12) lists A1, A7, A14, A22, A23, A26 as deferred. When extending the catalog for any of these:

1. Add the row to `CATALOG_IDS`, `CATALOG_DESCS`, `CATALOG_REGEXES`, `CATALOG_SCOPES` in parallel (keep array indices aligned).
2. Add a vitest case in `src/lib/__tests__/anti-pattern-a10.test.ts` (or split into `anti-pattern-catalog.test.ts` for the next 5 rows).
3. Update the header documentation table in the script (`# ID | Description | Regex | Where` block) and `CONTRIBUTING.md` §3.1 table.
4. Verify the regex against the current source tree: `bash scripts/check-anti-patterns.sh --all` must still exit 0 (the new row should not flag any existing code).

### Future Topbar profile page (Sprint 7+)

If a `Hồ sơ` (profile) page is ever built:

1. Replace `handleProfilePlaceholder` (currently shows a "Tín năng đang phát triển" toast per Story 6.3.4 / B.4.4) with `router.push('/profile')`.
2. The `data-testid="topbar-profile-menu-item"` and `aria-label="Hồ sơ (đang phát triển)"` should be updated to drop the "đang phát triển" hint.
3. The `FALLBACK_USER_ID` literal still applies: if a user is somehow unauthenticated, the topbar still renders the user menu (just with `displayName: undefined` → falls back to 'User' string at line 314 of `topbar.tsx`).

---

## Testing your migration

```bash
# 1. Pre-commit gate still passes on the full tree
bash scripts/check-anti-patterns.sh --all
# Expected: exit 0, no output

# 2. New A10 row catches deliberate violations
cat > /tmp/a10-test.tsx << 'EOF'
<input type="number" name="amount" />
EOF
cp /tmp/a10-test.tsx src/components/__a10_smoke.tsx
bash scripts/check-anti-patterns.sh --all
# Expected: exit 1, reports A10 violation at src/components/__a10_smoke.tsx:1
rm src/components/__a10_smoke.tsx

# 3. Topbar fallback uses 'placeholder', not 'user-001'
npx vitest run src/components/layout/__tests__/topbar-profile-toast.test.tsx
# Expected: 12/12 tests pass (10 pre-existing + 2 new PI-5 tests)

# 4. A10 catalog integrity
npx vitest run src/lib/__tests__/anti-pattern-a10.test.ts
# Expected: 17/17 tests pass

# 5. Full regression
npx vitest run
# Expected: 1062/1062 tests pass (Sprint 7.1 baseline + 19 PI-5 tests)
```

If any check fails, do NOT bypass with `--no-verify` — that masks the regression. Investigate the failure first.

---

## Sign-off

| Role | Sign-off criteria | Status |
|:-----|:------------------|:------:|
| `tech-lead` | Code review (PI-5 = trivial; tech-lead is the owner per Sprint 7.2 §1 row 10) | ✅ |
| `qa-architect` | Test pyramid coverage: 19 new tests across 2 files; covers TD-7 (L1 + L4) + A10 (L1) | ✅ |
| `release-manager` | Build & quality gates (§6) all green; rollback is `< 60s` with no data impact (§7) | ✅ |

No C-6 / C-7 / C-8 accountant pairing required (PI-5 is anti-pattern/TD-7 cleanup; no revenue impact).

---

*End of STORY_PI_5_MIGRATION_NOTES.*
