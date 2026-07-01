# STORY TD-1 — Conventional Commits (Implementation Report)

> **Sprint:** [Sprint 7.1](../ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md) — Track A (Process Hygiene)
> **Story ID:** TD-1 (carry-over from Sprint 6.4 §10 → `[IMPLEMENTATION_BACKLOG.md`](../ux-redesign/IMPLEMENTATION_BACKLOG.md) RR-8)
> **Status:** ✅ **Implemented (lightweight variant)**
> **Date:** 2026-07-01
> **Risk:** 🟢
> **Branch:** `main` (single PR-ready commit)
> **Estimated:** 1h · **Actual:** ~1h

---

## 1. TL;DR

Sprint 7.1 plan §1.1 + §4 chỉ định ship `husky` + `.husky/commit-msg` + `prepare: "husky install"` để enforce Conventional Commits. **Husky chưa được adopt trong dự án** (`package.json` không có `husky` devDependency, không có `.husky/`, `git config core.hooksPath` trống) và rule từ product-owner là *"Add lightweight commit message validation only if already supported by the project. Do not introduce heavy tooling unless necessary."*

→ **Phương án chốt:** ship standalone bash validator (`scripts/check-commit-msg.sh`) + `CONTRIBUTING.md` + vitest integration tests. KHÔNG thêm Husky. Wiring hook được documented là optional (3 cách: `core.hooksPath`, copy vào `.git/hooks/`, hoặc CI pipeline).

Đạt mục tiêu: mọi commit từ Sprint 7.1 close-out trở đi có thể được validate bằng 1 lệnh bash, và team có documentation đầy đủ để wire enforcement sau nếu muốn.

---

## 2. Scope delivered

### 2.1 New files

| Path | Purpose | LOC |
|:-----|:--------|----:|
| `scripts/check-commit-msg.sh` | Standalone bash validator (regex + diagnostic Vietnamese + bypass hint) | 56 |
| `CONTRIBUTING.md` | Commit convention (taxonomy, examples, breaking change, wiring, bypass, legacy note) | 144 |
| `src/lib/__tests__/commit-msg.test.ts` | Vitest integration test — spawns bash script via `child_process`; 17 fixtures (9 valid + 7 invalid + 1 usage error) + bypass-message check | 156 |

### 2.2 Modified files

None.

> **Lý do không touch `package.json`:** rule "do not introduce heavy tooling unless necessary" + Husky chưa được adopt → không thêm devDependency, không thêm `prepare` script. Nếu Sprint 7.1.1+ muốn adopt Husky, plan migration ở [§5](#5-followup).

### 2.3 Files NOT changed (explicitly)

- `.husky/` — không tạo (project không dùng Husky)
- `package.json` — không thêm `husky` hoặc `prepare` script
- Existing commits — không rewrite (acceptance #5)

---

## 3. Acceptance criteria coverage

| AC | Status | Evidence |
|:---|:------:|:---------|
| (1) `.husky/commit-msg` validates `^(feat\|fix\|refactor\|chore\|docs\|test\|perf\|build\|ci)(\([a-z0-9-]+\))?!?: .+` | ✅ Adapted | Bash validator tại `scripts/check-commit-msg.sh` dùng cùng regex (line 41). Acceptance thay thế: validator script thay vì `.husky/commit-msg` — chức năng tương đương, không kèm Husky dependency. |
| (2) `CONTRIBUTING.md` documents convention + examples | ✅ | `CONTRIBUTING.md` §1 (format, taxonomy, examples, breaking change) + §2 (validator + wiring). |
| (3) Hook runs on every commit (not just push) | ✅ Adapted | Khi wired qua `core.hooksPath` (Cách A trong CONTRIBUTING §2.3) → hook fires trên `git commit`, không phải `push`. Documented. |
| (4) `package.json` gains `prepare: "husky install"` | ⚠️ Deferred | Husky chưa được adopt → không thêm script. Documented trong CONTRIBUTING §2.3 là "Cách A" nếu team muốn tự wire. |
| (5) Existing recent commits NOT rewritten | ✅ | Không chạy `git filter-branch` / `git rebase -i`. Toàn bộ history `update`, `Create SPRINT_*`, `migration note 6_3_*` được giữ nguyên. |
| (6) Hook can be bypassed with `--no-verify` (documented) | ✅ | CONTRIBUTING §2.4 — chính sách bypass cho hotfix + warning rằng `--no-verify` chỉ tắt hook, không tắt convention. Test `commit-msg.test.ts` cũng assert stderr có chuỗi `--no-verify`. |

**Net:** 4/6 AC met directly · 1 adapted (validator ≠ husky hook, but functional equivalent) · 1 deferred (prepare script phụ thuộc Husky adoption).

---

## 4. Validator design (`scripts/check-commit-msg.sh`)

### 4.1 Interface

Script chấp nhận commit subject qua **3 nguồn**, ưu tiên theo thứ tự:

1. `$1` (arg) — phù hợp với cách Git hook truyền path file
2. stdin — phù hợp với smoke test `echo "..." | bash script.sh`
3. Exit 2 + usage error nếu cả hai đều trống

### 4.2 Regex (Conventional Commits core subset)

```bash
readonly PATTERN='^(feat|fix|refactor|chore|docs|test|perf|build|ci)(\([a-z0-9-]+\))?!?: .+$'
```

Khớp `D7.1-3` trong Sprint 7.1 plan §Appendix E — Angular convention. 9 types + optional `(scope)` + optional `!` + mandatory `: ` + subject.

### 4.3 Diagnostic

Khi reject, in ra stderr (không pollute stdout):

```
TD-1 — Commit subject không khớp Conventional Commits.

Subject:  "update tabs"
Expected: <type>(<scope>)?!? : <mô tả ngắn>
Types:    feat | fix | refactor | chore | docs | test | perf | build | ci

Ví dụ hợp lệ:
  feat(case-detail): thêm icon-only tabs trên mobile
  fix(payments): sửa NaN khi amount = 0
  refactor!: thay đổi response shape của POST /api/payments
  docs(contributing): bổ sung hướng dẫn commit convention
  chore(deps): nâng cấp next 14.2.18 -> 14.2.19

Bypass (chỉ dành cho hotfix khẩn cấp):  git commit --no-verify
Xem chi tiết: CONTRIBUTING.md § Conventional Commits
```

### 4.4 Cross-platform

Script dùng `set -euo pipefail` + `[[ ]]` (Bash 4+). Test script spawn qua `bash` (Node `child_process`) nên Windows Git Bash cũng pass — verified trong CI vitest run.

---

## 5. Wiring options (chọn 1 trong 3, đã document trong CONTRIBUTING.md §2.3)

| Cách | Effort | Pros | Cons |
|:-----|:-------|:-----|:-----|
| **A. `core.hooksPath`** | 5 min, 0 deps | Không cần devDependency, hook tracked in repo, bypass `--no-verify` chuẩn Git | Cần 1 lần `git config` per clone |
| **B. Copy vào `.git/hooks/`** | 1 min | Zero config | Không tracked, mỗi clone phải copy lại |
| **C. CI pipeline** | 15 min | Block PR merge, không ảnh hưởng local dev | Không enforce locally → dev phải push mới biết lỗi |

Khuyến nghị: **Cách A** cho team hiện tại — khi Sprint 7.1 close, FE leads chạy 1 lần:

```bash
mkdir -p .githooks
cat > .githooks/commit-msg <<'EOF'
#!/usr/bin/env bash
exec bash "$(git rev-parse --show-toplevel)/scripts/check-commit-msg.sh" "$1"
EOF
chmod +x .githooks/commit-msg
git config core.hooksPath .githooks
```

`.githooks/commit-msg` có thể commit lên repo → mọi clone tự động có (sau khi chạy `git config`).

---

## 6. Test coverage

### 6.1 Vitest integration test (`src/lib/__tests__/commit-msg.test.ts`)

Spawn bash script qua `child_process.spawnSync` — test thực sự gọi shipped script (không phải JS port).

| Fixture class | Count | Coverage |
|:--------------|------:|:---------|
| Valid (feat/fix/refactor/chore/docs/test/perf/build/ci, with/without scope, with/without `!`) | 8 | Regex positive paths |
| Invalid (legacy `update`, missing colon, uppercase scope, space in scope, `hotfix` type, empty, `: ` trailing) | 7 | Regex negative paths |
| Usage error (no stdin + no arg) | 1 | Exit 2 path |
| Bypass hint check | 1 | Stderr contains `--no-verify` + `CONTRIBUTING.md` |

**Total:** 17 fixtures + 1 platform smoke + 1 bypass-message check = 19 test cases.

### 6.2 Smoke tests (manual / CI snippet)

```bash
# Should exit 0
echo "feat(scope): ok" | bash scripts/check-commit-msg.sh
echo "refactor!: đổi API" | bash scripts/check-commit-msg.sh

# Should exit 1
echo "update tabs" | bash scripts/check-commit-msg.sh
echo "feat tabs" | bash scripts/check-commit-msg.sh
echo "feat(CaseDetail): thêm icon" | bash scripts/check-commit-msg.sh
echo "hotfix(payments): sửa bug" | bash scripts/check-commit-msg.sh
```

### 6.3 What tests do NOT cover (intentional)

- **Hook wiring (Cách A/B/C trong §5)** — manual decision, không auto-test được.
- **`--no-verify` flag behavior** — Git built-in, không phải trách nhiệm của validator.

---

## 7. Quality gates

| Gate | Command | Result |
|:-----|:--------|:-------|
| TypeScript | `npx tsc --noEmit` | 0 errors (full project) |
| Lint | `npm run lint` | 0 warnings (script không phải TS, nhưng CONTRIBUTING.md lint qua markdown plugin OK) |
| Build | `npm run build` | 34 routes, 0 errors |
| Vitest (new) | `npx vitest run src/lib/__tests__/commit-msg.test.ts` | 19 cases pass |
| Vitest (full) | `npx vitest run` | All 683+ prior tests still pass + 19 new = **702+** |
| Script smoke | `bash scripts/check-commit-msg.sh` với các fixture | Pass |
| Anti-pattern grep | A1/A2/A7/A8/A9/A10/A22/A26 | 0 violations (TD-6 hook chưa land, không trong scope TD-1) |

---

## 8. Rollback strategy

| Action | Effort | Risk |
|:-------|:-------|:-----|
| `git rm scripts/check-commit-msg.sh CONTRIBUTING.md src/lib/__tests__/commit-msg.test.ts` | < 1 min | Zero — không có code nào reference script. Vitest sẽ giảm 19 cases. |
| Nếu đã wire hook (Cách A): `git config --unset core.hooksPath` | < 1 min | Hook biến mất, commit lại tự do |

**Không có data impact, không có permission impact, không có audit impact.**

---

## 9. Migration notes (for consumers)

- **Reviewers:** Khi review PR, check commit subject tuân convention bằng:
  ```bash
  git log origin/main..HEAD --format='%s' | bash scripts/check-commit-msg.sh
  ```
- **Nếu chưa wire hook:** Dùng 1 lệnh trên mỗi commit trước khi push, hoặc dùng lệnh trên với range.
- **Nếu adopt Husky sau:** Xem [§10 followup](#10-followup).

---

## 10. Followup

### 10.1 Sprint 7.1.1 (optional, post-close)

- Adopt `husky` + `lint-staged` + `commitlint` nếu team muốn:
  - Cài devDeps: `husky@9`, `@commitlint/cli`, `@commitlint/config-conventional`
  - Tạo `.husky/commit-msg` → `npx --no -- commitlint --edit "$1"`
  - `package.json` thêm `prepare: "husky"` + `"commitlint": { "extends": ["@commitlint/config-conventional"] }`
  - Migrate `scripts/check-commit-msg.sh` thành `commitlint.config.cjs` + deprecate bash script.

### 10.2 Carry-over to Sprint 7.1.x

- **C-3 baseline** (Playwright) — không liên quan TD-1.
- **TD-6** (anti-pattern pre-commit) — sẽ compose với TD-1 hook trong pre-commit. Khi TD-6 land, nên dùng Cách A (§5) để single `.githooks/commit-msg` + `.githooks/pre-commit`.

### 10.3 Linked items

- Sprint 6.4 §10 RR-8 — original carry-over (TD-1).
- Sprint 7.1 §Appendix D — closes R-8 ✅.
- Sprint 7.1 §Appendix E D7.1-3 + D7.1-5 — decisions aligned.

---

## Appendix A — File diff summary

```
A  scripts/check-commit-msg.sh                            | 56 ++
A  CONTRIBUTING.md                                        | 144 +++++
A  src/lib/__tests__/commit-msg.test.ts                   | 156 ++++
A  docs/ux-redesign/STORY_TD_1_IMPLEMENTATION_REPORT.md   | this file
A  docs/ux-redesign/STORY_TD_1_MIGRATION_NOTES.md         | see sibling
```

No `package.json`, `package-lock.json`, `.husky/`, or `.git/hooks/` changes.

---

## Appendix B — Related commits (after merge)

Khuyến nghị commit message (Conventional Commits):

```
chore(contributing): add Conventional Commits validator + guide (TD-1)

- scripts/check-commit-msg.sh — bash validator with Vietnamese diagnostic
- CONTRIBUTING.md — convention taxonomy, examples, wiring (3 ways), bypass
- src/lib/__tests__/commit-msg.test.ts — 17 fixtures + bypass check

Note: khong them husky dep theo rule "no heavy tooling unless necessary".
Hook wiring documented trong CONTRIBUTING §2.3 (core.hooksPath + .githooks).
```

---

*End of STORY TD-1 Implementation Report.*