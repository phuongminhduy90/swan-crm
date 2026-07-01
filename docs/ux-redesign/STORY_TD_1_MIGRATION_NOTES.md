# STORY TD-1 — Conventional Commits (Migration Notes)

> Hướng dẫn migrate sang Conventional Commits cho Swan CRM — đi kèm [STORY_TD_1_IMPLEMENTATION_REPORT.md](STORY_TD_1_IMPLEMENTATION_REPORT.md).

---

## 1. Ai cần đọc?

| Vai trò | Đọc phần |
|:--------|:---------|
| **FE/BE/QA contributor** | §2 (commit format), §3 (existing commits), §4 (trước commit đầu tiên) |
| **Tech lead / release manager** | §5 (wire hook), §6 (review checklist), §7 (bypass policy) |
| **CI / DevOps** | §8 (CI integration), §9 (rollback) |

---

## 2. Commit format từ Sprint 7.1 trở đi

Mỗi commit subject phải tuân:

```
<type>(<scope>)?!?: <mô tả ngắn>
```

**9 type được phép:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci`

**Scope** (optional): chữ thường + số + dấu gạch ngang. VD: `case-detail`, `payments`, `toast`, `api`, `contributing`.

**Breaking change** (`!`): thêm sau type/scope + kèm `BREAKING CHANGE:` trong body.

Xem chi tiết + examples: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) §1.

---

## 3. Existing commits — KHÔNG rewrite

Toàn bộ commit trước Sprint 7.1 (vd: `update`, `Create SPRINT_*.md`, `migration note 6_3_*`, `6.3.4`, ...) **được giữ nguyên**. Không chạy:

```bash
# KHÔNG chạy:
git rebase -i --exec 'git commit --amend -m "..."'
git filter-branch --msg-filter '...'
```

Lý do:
- Rewrite history phá vỡ SHAs đã cite trong PR comments, audit log, release notes.
- Conventional Commits chỉ áp dụng từ Sprint 7.1 close-out trở đi (per Sprint 6.4 §10 carry-over note).
- Tra cứu sprint/story của commit cũ: dùng `git log --grep="SPRINT_"` hoặc `docs/ux-redesign/SPRINT_*_COMPLETION_REPORT.md`.

---

## 4. Trước commit đầu tiên (1 lần)

### 4.1 Nếu team muốn enforce tự động (khuyến nghị)

Một FE lead chạy 1 lần trên mỗi clone:

```bash
mkdir -p .githooks
cat > .githooks/commit-msg <<'EOF'
#!/usr/bin/env bash
exec bash "$(git rev-parse --show-toplevel)/scripts/check-commit-msg.sh" "$1"
EOF
chmod +x .githooks/commit-msg
git config core.hooksPath .githooks
```

Sau đó commit file `.githooks/commit-msg` lên repo:

```bash
git add .githooks/commit-msg
git commit -m "chore(contributing): wire core.hooksPath to validator (TD-1 wiring)"
```

**Từ commit kế tiếp**, mọi `git commit` sẽ trigger validator.

### 4.2 Nếu không muốn wire hook (chỉ dùng convention)

Không cần làm gì — chỉ cần tự validate trước khi push:

```bash
echo "feat(case-detail): thêm icon-only tabs" | bash scripts/check-commit-msg.sh
# Nếu exit 0 → OK. Nếu exit 1 → xem diagnostic + sửa.
```

---

## 5. Wire hook — 3 cách chọn 1

Xem chi tiết trong [`CONTRIBUTING.md` §2.3](../../CONTRIBUTING.md). Tóm tắt:

| Cách | Lệnh | Trade-off |
|:-----|:------|:----------|
| A. `core.hooksPath` + `.githooks/commit-msg` | (snippet §4.1) | **Khuyến nghị.** Tracked trong repo, 0 dep. |
| B. Copy `scripts/check-commit-msg.sh` → `.git/hooks/commit-msg` | `cp scripts/check-commit-msg.sh .git/hooks/commit-msg && chmod +x $!` | Zero config, nhưng mỗi clone phải copy lại. |
| C. CI pipeline | See CONTRIBUTING §2.3 | Block merge, không enforce local. |

**Recommendation:** Cách A. Lệnh 1 lần, tracked trong repo, mọi contributor chỉ cần `git config core.hooksPath .githooks` 1 lần sau khi clone.

---

## 6. Review checklist (cho PR reviewer)

Khi review PR:

```bash
# Lấy tất cả commit subjects của PR
git log origin/main..HEAD --format='%s'

# Validate từng cái
for subj in $(git log origin/main..HEAD --format='%s'); do
  echo "$subj" | bash scripts/check-commit-msg.sh || echo "❌ FAIL: $subj"
done
```

Hoặc nhanh hơn (nếu hook đã wire):

```bash
git log origin/main..HEAD --format='%s' | bash scripts/check-commit-msg.sh
```

**Reject PR nếu** bất kỳ commit nào fail convention (trừ khi PR có note giải trình + được tech-lead approve).

---

## 7. Bypass policy — `git commit --no-verify`

**Khi nào được dùng:**

| Tình huống | Được bypass? |
|:-----------|:------------:|
| Hotfix P0/P1 trên production (outage, data corruption) | ✅ Có, kèm PR review note |
| Cú pháp legacy cần giữ (vd: revert commit, merge commit) | ❌ Không — vẫn phải tuân convention |
| "Tôi lười sửa subject" | ❌ Không — sửa lại subject |

**Quy tắc:**

1. `--no-verify` chỉ tắt **hook**, không tắt **convention**. Subject vẫn phải tuân.
2. Mỗi bypass phải có PR description note: lý do bypass + tech-lead approval.
3. Nếu subject fail convention → reviewer yêu cầu rewrite (squash/reword) trước merge.

---

## 8. CI integration (optional, Cách C)

Thêm job vào `.github/workflows/` (snippet):

```yaml
name: Commit lint
on: [pull_request]
jobs:
  lint-commits:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Validate commit subjects
        run: |
          for sha in $(git rev-list origin/${{ github.base_ref }}..HEAD); do
            git log -1 --format='%s' "$sha" \
              | bash scripts/check-commit-msg.sh \
              || { echo "❌ Commit $sha violates Conventional Commits"; exit 1; }
          done
```

**Trade-off:** Cách C block merge, nhưng không enforce local. Dev phải push mới biết lỗi → chậm feedback. Kết hợp A + C để có local + CI guard.

---

## 9. Rollback

Nếu cần revert TD-1:

```bash
git revert <commit-sha-TD-1>
# Hoặc:
git rm scripts/check-commit-msg.sh CONTRIBUTING.md src/lib/__tests__/commit-msg.test.ts
git commit -m "revert: rollback TD-1 Conventional Commits"
```

Nếu đã wire hook (Cách A):

```bash
git config --unset core.hooksPath
git rm .githooks/commit-msg
git commit -m "revert: unwire commit-msg hook"
```

**Blast radius:** 0 — script không reference từ source code nào. Vitest giảm 19 cases nhưng không fail existing suite.

---

## 10. Quick reference card

```bash
# Validate 1 subject
echo "feat(scope): mô tả" | bash scripts/check-commit-msg.sh

# Validate tất cả commits trong PR
git log origin/main..HEAD --format='%s' | bash scripts/check-commit-msg.sh

# Bypass (hotfix only)
git commit --no-verify -m "fix: hotfix XYZ"

# Test validator
npm test -- src/lib/__tests__/commit-msg.test.ts
```

**9 types nhớ:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci`.

**Template mặc định:** `<type>(<module>): <mô tả tiếng Việt không dấu OK>`.

**Khi nào dùng scope:** khi commit thay đổi 1 module cụ thể. Nếu touch nhiều module → bỏ scope hoặc dùng `chore`/`refactor` không scope.

---

*End of STORY TD-1 Migration Notes.*