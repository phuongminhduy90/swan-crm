# STORY_TD_6 — Migration Notes

> **Sprint:** [Sprint 7.1](../SPRINT_7_1_EXECUTION_PLAN.md)
> **Story ID:** TD-6
> **Title:** Anti-pattern pre-commit hook (`scripts/check-anti-patterns.sh`)
> **Status:** ✅ Implemented
> **Impact type:** Process/tooling only (no UI, no data model, no runtime change)
> **Risk:** 🟢

---

## 1. Summary (for all reviewers)

**What changed:**
A new lightweight pre-commit guard (`scripts/check-anti-patterns.sh`) now exists. It greps staged files (or the full source tree in `--all` mode) for four known anti-pattern classes (A2, A8, A9, ESC) that were formally closed in Sprints 6.3–6.4. Any future commit introducing these patterns will be flagged.

**What did NOT change:**
- No runtime code modified
- No `package.json` dependencies added
- No feature flags added or promoted
- No schema / Firestore changes
- No UI behaviour change
- Existing code in `topbar.tsx:71` (the `user-001` fallback ID) is left untouched — see §3

---

## 2. Who is affected

| Role | Impact | Action needed |
|:-----|:-------|:--------------|
| All FE/BE/QA/PO developers | Commits may be rejected by the pre-commit hook if an anti-pattern is introduced | Read `CONTRIBUTING.md §3`; run `bash scripts/check-anti-patterns.sh --help` locally |
| CI pipeline owner | CI now recommends adding `--all` mode run as a workflow step | Copy CI snippet from `CONTRIBUTING.md §3.3` into `.github/workflows/` at first opportunity |
| Tech debt backlog owner | A2 pattern has 1 known pre-existing hit in `topbar.tsx:71` (documented as out-of-scope) | Log as TD-7 item: replace `'user-001'` with a named constant or `'placeholder'` |

**No consumer is impacted beyond the above.**

---

## 3. Known pre-existing A2 match (TD-6 out-of-scope)

```text
src/components/layout/topbar.tsx:71 — const currentUserId = userProfile?.id ?? 'user-001';
```

This line matches the A2 regex `user-\d{3}` because `'user-001'` is a fallback ID, not displayed in the UI. `--staged` mode never sees it (no diff), so `git commit` is not blocked. `--all` mode reports it.

**Recommended fix (follow-up story):**
```ts
// BEFORE
const currentUserId = userProfile?.id ?? 'user-001';
// AFTER
const CURRENT_USER_FALLBACK = 'placeholder' as const; // TD-7 cleanup
const currentUserId = userProfile?.id ?? CURRENT_USER_FALLBACK;
```
File: `src/components/layout/topbar.tsx`

Severity: informational only — no runtime effect, no UI exposure.

---

## 4. How to use (copy for all team members)

### Quick start — 2 steps

```bash
# 1. Opt in to pre-commit hook (one-time, per clone)
git config core.hooksPath .githooks

# 2. Verify
git add scripts/check-anti-patterns.sh
git commit --dry-run -m "test: verify hook wiring"
# You should see: TD-6 anti-pattern gate — mode: staged (staged files)
```

### Full manual run (CI / annual audit)

```bash
bash scripts/check-anti-patterns.sh --all
# exit 0 = clean | exit 1 = regression found (fix before merge)
```

### Bypass (hotfix only)

```bash
git commit --no-verify -m "fix(payments): hotfix production"
# Still must use Conventional Commits format (TD-1 §2.1)
```

---

## 5. Anti-pattern catalog reference

| ID  | What it catches | How to fix |
|:----|:----------------|:-----------|
| A2  | Hard-coded `user-NNN` IDs in `src/components/` | Use `userProfile.displayName` or a named constant; grep for `user-\d{3}` |
| A8  | `<a href="#">` placeholder links | Replace with `<button onClick={...}>` or proper `<Link href="...">` |
| A9  | `window.alert()` / `window.confirm()` | Use `useToast()` or `<ConfirmDialog>` from `@/components/ui/` |
| ESC | `eslint-disable.*no-alert` | Remove the directive; A9 is closed, no escape needed |

---

## 6. Comment-line filter (avoiding false positives)

The scanner **excludes** lines that are purely comments to prevent existing documentation from triggering violations. This means:

| Line | Detected? | Reason |
|:-----|:---------:|:-------|
| `if (window.confirm("really?"))` | ✅ Yes | Real code call |
| `// surfaces a Toast error instead of window.alert` | ❌ No | Pure comment; starts with `//` |
| `/* old code used window.confirm here */` | ❌ No | Pure block comment |
| `const x = window.alert` | ✅ Yes | Code reference, not comment-only |

If you write an anti-pattern in a comment and want to avoid the filter, rephrase the comment so it doesn't start the line with `//`/`/*`/`*` at the match point — or reword the comment (e.g. `// uses toast instead of alert`).

---

## 7. Wiring options (3 paths)

**Recommended:** Option A (zero dependencies, works on all platforms).

| Option | Command | Pros | Cons |
|:-------|:--------|:-----|:-----|
| A | `git config core.hooksPath .githooks` | 0 deps; hook files tracked in repo | Must run once per clone |
| B | `cp .githooks/pre-commit .git/hooks/pre-commit` | Familiar Git pattern | Hook file not tracked in repo |
| C | CI workflow (GitHub Actions) | Enforced server-side on every PR | No local feedback; slower |

All three are documented in `CONTRIBUTING.md §3.3`.

---

## 8. Extending the catalog (for Sprint 7.4+)

The script uses flat arrays (`CATALOG_IDS`, `CATALOG_DESCS`, `CATALOG_REGEXES`, `CATALOG_SCOPES`) — adding a new pattern is a single 4-line block:

```bash
CATALOG_IDS+=(  "A10" )
CATALOG_DESCS+=( "raw numeric currency inputs" )
CATALOG_REGEXES+=( '<input[^>]*type="number"' )
CATALOG_SCOPES+=( "src/components/cases" )
```

Documented in `STORY_TD_6_IMPLEMENTATION_REPORT.md §3` (full catalog mapping).

---

## 9. Rollback

```bash
# Remove files
git rm scripts/check-anti-patterns.sh .githooks/pre-commit

# Unset hook (if wired via core.hooksPath)
git config --unset core.hooksPath

# Revert CONTRIBUTING.md changes
git revert <commit-sha>

# Manual gate (still works):
grep -rE "window\.(confirm|alert)" src/ | grep -v __tests__/
grep -rE 'href=["\\047]#["\\047]' src/components/
grep -rE "user-\\d{3}" src/components/
```

Grep commands above are the "belt-and-suspenders" fallback documented in CONTRIBUTING.md §3.1.

---

## 10. Cross-reference

- **Implementation report:** [`STORY_TD_6_IMPLEMENTATION_REPORT.md`](STORY_TD_6_IMPLEMENTATION_REPORT.md)
- **Sprint 7.1 plan:** [`SPRINT_7_1_EXECUTION_PLAN.md`](SPRINT_7_1_EXECUTION_PLAN.md) §1.1 (TD-6 acceptance criteria), §8.4 (cumulative catalog)
- **Sprint 6.4 completion:** [`SPRINT_6_4_COMPLETION_REPORT.md`](SPRINT_6_4_COMPLETION_REPORT.md) §10 (TD-6 carry-over)
- **CONTRIBUTING.md §3:** [CONTRIBUTING.md](../../CONTRIBUTING.md#3-anti-pattern-pre-commit-guard-td-6)

---

*End of STORY_TD_6_MIGRATION_NOTES.*
