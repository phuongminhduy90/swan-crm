# Contributing to Swan Case CRM

> Hướng dẫn đóng góp cho Swan Case CRM — dành cho FE/BE/QA/PO tham gia sprint.

## 1. Conventional Commits (TD-1)

Toàn bộ commit subject **bắt buộc** tuân theo [Conventional Commits 1.0.0](https://www.conventionalcommits.org/), bắt đầu từ Sprint 7.1.

### 1.1 Format

```
<type>(<scope>)?!?: <mô tả ngắn>
```

| Thành phần   | Bắt buộc | Quy tắc                                                              |
|:-------------|:---------|:---------------------------------------------------------------------|
| `type`       | ✅       | Một trong: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `build`, `ci` |
| `scope`      |          | Tên module/area — chữ thường, số, dấu gạch ngang. VD: `case-detail`, `payments`, `toast` |
| `!`          |          | Đánh dấu **breaking change** — kèm `BREAKING CHANGE:` trong body      |
| `:` + space  | ✅       | Separator sau type/scope                                              |
| Subject text | ✅       | Tiếng Việt không dấu OK, mô tả 1 dòng ≤ 72 ký tự                     |

### 1.2 Type taxonomy (Swan CRM)

| Type       | Khi nào dùng                                                                  | Ví dụ                                                       |
|:-----------|:------------------------------------------------------------------------------|:------------------------------------------------------------|
| `feat`     | Thêm feature / API mới / prop mới                                             | `feat(case-detail): thêm icon-only tabs trên mobile`        |
| `fix`      | Sửa bug (kèm repro trong PR)                                                  | `fix(payments): sửa NaN khi amount = 0`                     |
| `refactor` | Tái cấu trúc code KHÔNG đổi hành vi                                          | `refactor(notifications): migrate sang shared <Tabs>`        |
| `chore`    | Tooling, deps, config, housekeeping                                           | `chore(deps): nâng cấp next 14.2.18 -> 14.2.19`             |
| `docs`     | Chỉ tài liệu (README, CLAUDE.md, story reports, migration notes)             | `docs(contributing): bổ sung commit convention`             |
| `test`     | Chỉ thêm/sửa test                                                             | `test(toast): thêm backward-compat tests`                    |
| `perf`     | Tối ưu hiệu năng (bundle size, query time) — có số liệu trước/sau            | `perf(reports): giảm shared JS 4KB nhờ memo chart wrapper`   |
| `build`    | Thay đổi build pipeline / config (next.config, tsconfig, tailwind)             | `build(tsconfig): bật noUncheckedIndexedAccess`              |
| `ci`       | Thay đổi CI pipeline / GitHub Actions / Vercel hooks                         | `ci(github): thêm axe-core job cho 5 tabs consumers`         |

### 1.3 Ví dụ hợp lệ

```bash
feat(case-detail): thêm icon-only tabs trên mobile
fix(payments): sửa NaN khi amount = 0
refactor!: thay đổi response shape của POST /api/payments
docs(contributing): bổ sung hướng dẫn commit convention
chore(deps): nâng cấp next 14.2.18 -> 14.2.19
test(toast): thêm backward-compat tests
perf(reports): giảm shared JS 4KB nhờ memo chart wrapper
```

### 1.4 Ví dụ KHÔNG hợp lệ (sẽ bị reject)

| Subject                          | Lý do                                            |
|:---------------------------------|:-------------------------------------------------|
| `update tabs`                    | Thiếu type + colon                               |
| `feat tabs`                      | Thiếu colon sau type                             |
| `feat(case detail): thêm icon`   | Scope chứa dấu cách — phải là `case-detail`      |
| `feat(CaseDetail): thêm icon`    | Scope phải lowercase                             |
| `feat(case-detail) thêm icon`    | Thiếu colon                                       |
| `hotfix(payments): sửa bug`      | `hotfix` không nằm trong allowed types — dùng `fix` |

### 1.5 Breaking change

Thêm `!` sau type/scope **và** mô tả trong body:

```bash
refactor(api)!: đổi response shape của GET /api/payments

BREAKING CHANGE: trường `items` đổi thành `data`, `total` đổi thành `meta.total`.
Cập nhật frontend callers: src/components/payments/payment-list.tsx
```

### 1.6 Multi-line commit

Subject là dòng đầu tiên; body cách subject bằng **1 dòng trống**:

```
feat(toast): mở rộng API với { title, description, action, duration }

- Thêm prop `action` cho CTA inline ("Xem case")
- Thêm `duration: 0` = sticky toast
- Backward-compat: `toast('msg')` legacy vẫn chạy
```

---

## 2. Commit validation (TD-1)

### 2.1 Validator

`scripts/check-commit-msg.sh` — bash script đọc commit subject từ stdin hoặc arg, so khớp regex:

```regex
^(feat|fix|refactor|chore|docs|test|perf|build|ci)(\([a-z0-9-]+\))?!?: .+
```

### 2.2 Smoke test

```bash
# Hợp lệ
$ echo "feat(scope): ok" | bash scripts/check-commit-msg.sh
$ echo "fix(payments): sửa NaN" | bash scripts/check-commit-msg.sh
$ echo "refactor!: đổi API" | bash scripts/check-commit-msg.sh

# Không hợp lệ
$ echo "update tabs" | bash scripts/check-commit-msg.sh   # → exit 1 + error
$ echo "feat tabs" | bash scripts/check-commit-msg.sh     # → exit 1 + error
```

### 2.3 Wiring (tùy chọn — chọn 1 trong 3)

Project hiện **CHƯA** adopt Husky để tránh thêm dependency. Chọn 1 trong 3 cách dưới nếu muốn enforce tự động:

**Cách A — `core.hooksPath` (khuyến nghị, 0 dependency):**

```bash
mkdir -p .githooks
cat > .githooks/commit-msg <<'EOF'
#!/usr/bin/env bash
exec bash "$(git rev-parse --show-toplevel)/scripts/check-commit-msg.sh" "$1"
EOF
chmod +x .githooks/commit-msg

git config core.hooksPath .githooks
```

**Cách B — copy trực tiếp vào `.git/hooks/`:**

```bash
cp scripts/check-commit-msg.sh .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

**Cách C — CI pipeline (chạy trên mọi PR):**

```yaml
# .github/workflows/commit-lint.yml (snippet)
- name: Validate commit messages
  run: |
    for sha in $(git rev-list origin/main..HEAD); do
      git log -1 --format='%s' "$sha" \
        | bash scripts/check-commit-msg.sh \
        || { echo "Commit $sha violates Conventional Commits"; exit 1; }
    done
```

### 2.4 Bypass — `--no-verify`

Khi hook đã wired, có thể bypass cho hotfix khẩn cấp:

```bash
git commit --no-verify -m "fix: hotfix production"
```

**Chính sách bypass:**
- Chỉ dùng cho hotfix P0/P1 trên production.
- Subject vẫn PHẢI tuân convention — `--no-verify` chỉ tắt hook, không tắt quy tắc.
- Mỗi bypass phải được review trong PR + ghi chú trong PR description.

---

## 3. Anti-pattern pre-commit guard (TD-6)

Toàn bộ commit — kể từ Sprint 7.1 close — phải vượt qua
[`scripts/check-anti-patterns.sh`](scripts/check-anti-patterns.sh) trước khi được ghi lịch sử.

### 3.1 Anti-pattern catalog

Script kiểm tra **5 nhóm** anti-pattern (đã đóng ở Sprint 6.x / 7.x, kẻ cũ tái xâm nhập = regression):

| ID  | Mô tả                                | Regex                                          | Phạm vi           |
|:----|:-------------------------------------|:-----------------------------------------------|:------------------|
| A2  | Raw `user-*` IDs trong UI            | `user-\d{3}`                                   | `src/components`  |
| A8  | Dead `href="#"` links                | `href=["']#["']`                               | `src/components`  |
| A9  | Native `window.confirm` / `alert`    | `window\.(confirm\|alert)\s*\(`                | `src`             |
| A10 | Raw `<input type="number">` cho tiền | `<[iI]nput[^>]*(type=['"]number['"])[^>]*(currency\|amount\|price\|VNĐ\|tiền)` | `src/components`  |
| ESC | `eslint-disable` cho `no-alert`      | `eslint-disable[^"']*no-alert`                 | `src`             |

**Ngoại lệ:** comment-only line (`// ...`, `/* ... */`, `* ...`) được bỏ qua để tránh false-positive trên docs/documentation comments — ví dụ `// thay thế window.alert bằng <Toast>` không trigger.

**Ngoại lệ khác:** `__tests__/`, `*.test.*`, `*.spec.*`, `.next/`, `node_modules/`, `playwright-report/`.

**Lưu ý A10 (Sprint 7.2 PI-5):**

- `<input type="number">` cho trường tiền tệ dễ bị sai do locale (VN accountant gõ `1,500,000` bị coerce thành `1.5`).
- Phải dùng `<CurrencyInput>` từ `@/components/ui/currency-input` (primitive ra mắt ở C.2.1 Sprint 7.2).
- A10 chỉ match trên cùng 1 dòng (`[^>]*` không span newline). Các input multi-line `<input\n  type="number"\n  ...>` KHÔNG bị match bởi gate — đây là tính năng cố ý để tránh chặn code đa dòng trong khi C.2.1 chưa migrate xong. Sprint 7.2 day 1–2 sẽ migrate toàn bộ call sites sang `<CurrencyInput>` (riêng story C.2.1, ngoài phạm vi PI-5).

### 3.2 Chạy thủ công

```bash
# Quét STAGED files — đây là mode `pre-commit` hook sử dụng
bash scripts/check-anti-patterns.sh --staged   # mặc định cũng vậy

# Quét TOÀN BỘ source tree — cho CI / audit định kỳ / annual sweep
bash scripts/check-anti-patterns.sh --all

# Trợ giúp
bash scripts/check-anti-patterns.sh --help
```

**Exit codes:**
- `0` — clean (không có vi phạm)
- `1` — có ít nhất 1 match; output liệt kê `<ID>: <file>:<line>` cho từng vi phạm
- `2` — sai argument hoặc không có git work tree

**Output ví dụ (deliberate violation):**

```
TD-6 anti-pattern gate — mode: all (full source tree)
─────────────────────────────────────────────────────────────
[A9] native window.confirm / window.alert
    src/components/__td6_smoke.tsx:9:  if (window.confirm("really delete?")) {

TD-6: 1 anti-pattern match(es) detected.
```

### 3.3 Wiring (tùy chọn — chọn 1 trong 3)

Project hiện **CHƯA** adopt Husky để giữ footprint nhỏ (TD-6 = lightweight theo Sprint 7.1 §0).
Ba cách dưới nếu muốn enforce tự động:

**Cách A — `core.hooksPath` (khuyến nghị, 0 dependency):**

```bash
git config core.hooksPath .githooks
# (.githooks/pre-commit đã có sẵn trong repo, invoke scripts/check-anti-patterns.sh)
```

**Cách B — copy trực tiếp vào `.git/hooks/`:**

```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Cách C — CI pipeline (chạy trên mọi PR):**

```yaml
# .github/workflows/anti-pattern.yml (snippet)
- name: TD-6 anti-pattern gate (--all mode)
  run: |
    bash scripts/check-anti-patterns.sh --all \
      || { echo "Anti-pattern regression found"; exit 1; }
```

### 3.4 Bypass — `--no-verify`

Khi hook đã wired, có thể bypass cho hotfix khẩn cấp:

```bash
git commit --no-verify -m "fix(payments): hotfix production"
```

**Chính sách bypass (giống TD-1 §2.4):**
- Chỉ dùng cho hotfix P0/P1 trên production.
- Bypass chỉ tắt hook — anti-pattern vẫn tồn tại trong code; fix ở commit kế tiếp.
- Mỗi bypass phải được review trong PR + ghi chú trong PR description.

### 3.5 Khi anti-pattern được phát hiện

1. **Đọc pattern ID + file:line** trong output của script.
2. **Sửa tại nguồn** (đây là regression của Sprint 6.x / 7.x closures):
   - A9 → dùng `<Toast>` / `<ConfirmDialog>` từ `@/components/ui/`.
   - A8 → dùng `<button onClick={...}>` thay cho `<a href="#">` hoặc dùng routing helper.
   - A2 → lấy `displayName` từ user profile, không hard-code `user-NNN`.
   - A10 → thay raw `<input type="number">` bằng `<CurrencyInput>` từ `@/components/ui/currency-input`. Primitive accept `value: number` + `onChange`, format VND thousand-separator tự động.
   - ESC → xóa comment `eslint-disable no-alert` — anti-pattern A9 đã đóng, không cần escape.
3. Re-stage + commit bình thường.

Nếu match nằm trong comment văn bản (không phải code), đổi cách diễn đạt để không còn khớp regex
(ví dụ: viết `window . alert` có khoảng trắng, hoặc dùng `[w]indow.alert`).

### 3.6 Tại sao lightweight (không dùng Husky / lint-staged)

- **0 dependency** — không tăng `package.json`, không phụ thuộc Node version.
- **Tách biệt khỏi npm scripts** — dev có thể chạy ngay cả khi `node_modules/` chưa install.
- **CI-friendly** — `bash scripts/check-anti-patterns.sh --all` chạy thẳng trong GitHub Actions / Vercel.
- **Dễ debug** — output giản dị (ID + file:line), không cần đọc qua JSON / hooks config.

Khi nào nên adopt Husky: nếu Sprint sau muốn 5+ pre-commit hooks (lint-staged, typecheck, format,
i18n key audit, etc.) — khi đó `husky` + `lint-staged` sẽ cân nhắc lại trong một TD-7+ tech debt item.

---

## 4. Legacy commits

Tất cả commit trước Sprint 7.1 (vd: `update`, `Create SPRINT_*.md`, `migration note 6_3_3`) **được giữ nguyên** — không rewrite git history. Conventional Commits chỉ áp dụng từ Sprint 7.1 close-out trở đi.

Nếu cần tra cứu sprint/story của một commit cũ, dùng `git log --grep="SPRINT_"` hoặc tham chiếu `docs/ux-redesign/SPRINT_*_COMPLETION_REPORT.md`.

---

## 5. Definition of Done (story-level)

Mỗi story trước khi handoff phải đạt:

- [ ] **Acceptance criteria** — mọi checkbox trong `STORY_*_EXECUTION_PLAN.md` được tick
- [ ] **Build + quality** — `npm run lint`, `npm run typecheck`, `npm run build` đều xanh
- [ ] **Tests** — `npm test` pass + thêm test cho behavior mới
- [ ] **Anti-pattern grep** — `bash scripts/check-anti-patterns.sh` exit 0
      (TD-6 §3 — quét `--all` cho audit, `--staged` cho commit; xem §3.2)
- [ ] **Commit subject** — tuân convention §1 (TD-1)
- [ ] **Docs** — `STORY_*_IMPLEMENTATION_REPORT.md` + `STORY_*_MIGRATION_NOTES.md` cập nhật

---

## 6. Liên hệ / câu hỏi

- **Tech debt backlog:** [`docs/ux-redesign/IMPLEMENTATION_BACKLOG.md`](docs/ux-redesign/IMPLEMENTATION_BACKLOG.md)
- **Sprint 7.1 plan:** [`docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md)
- **Phase plan tổng:** [`docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md`](docs/ux-redesign/SPRINT_7_EXECUTION_PLAN.md)
- **Quy tắc dự án:** [`CLAUDE.md`](CLAUDE.md)